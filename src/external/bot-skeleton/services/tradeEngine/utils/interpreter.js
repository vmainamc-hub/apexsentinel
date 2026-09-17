import { isMultiplierContract } from '@/components/shared';
import cloneThorough from '@/utils/clone';
import JSInterpreter from '@deriv/js-interpreter';
import { unrecoverable_errors } from '../../../constants/messages';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import Interface from '../Interface';
import { createScope } from './cliTools';

JSInterpreter.prototype.takeStateSnapshot = function () {
    const newStateStack = cloneThorough(this.stateStack, undefined, undefined, undefined, true);
    return newStateStack;
};

JSInterpreter.prototype.restoreStateSnapshot = function (snapshot) {
    this.stateStack = cloneThorough(snapshot, undefined, undefined, undefined, true);
    this.global = this.stateStack[0].scope.object || this.stateStack[0].scope;
    this.initFunc_(this, this.global);
};

const botInitialized = bot => bot && bot.tradeEngine.options;
const botStarted = bot => botInitialized(bot) && bot.tradeEngine.tradeOptions;
const shouldRestartOnError = (bot, errorName = '') =>
    !unrecoverable_errors.includes(errorName) && botInitialized(bot) && bot.tradeEngine.options.shouldRestartOnError;

const shouldStopOnError = (bot, errorName = '') => {
    const stopErrors = ['SellNotAvailableCustom', 'ContractCreationFailure', 'InvalidtoBuy'];
    if (stopErrors.includes(errorName) && botInitialized(bot)) return true;
    return false;
};

const timeMachineEnabled = bot => botInitialized(bot) && bot.tradeEngine.options.timeMachineEnabled;
const STOP_CONTRACT_WAIT_TIMEOUT_MS = 15000;

const Interpreter = () => {
    let $scope = createScope();
    let bot = Interface($scope);
    let interpreter = {};
    let onFinish;
    let stopPromise = null;
    let terminationPromise = null;

    $scope.observer.register('REVERT', watchName =>
        revert(watchName === 'before' ? $scope.beforeState : $scope.duringState)
    );

    function init() {
        $scope = createScope();
        bot = Interface($scope);
        interpreter = {};
        onFinish = () => {};
        terminationPromise = null;
    }

    function revert(state) {
        interpreter.restoreStateSnapshot(state);
        interpreter.paused_ = false;
        loop();
    }

    function loop() {
        if ($scope.stopped || !interpreter.run()) {
            onFinish(interpreter.pseudoToNative(interpreter.value));
        }
    }

    function createAsync(js_interpreter, func) {
        const asyncFunc = (...args) => {
            const callback = args.pop();
            const reversed_args = args.slice().reverse();
            const first_defined_arg_idx = reversed_args.findIndex(arg => arg !== undefined);
            const function_args = first_defined_arg_idx < 0 ? [] : reversed_args.slice(first_defined_arg_idx).reverse();

            func(...function_args.map(arg => js_interpreter.pseudoToNative(arg)))
                .then(rv => {
                    if ($scope.stopped) return;
                    callback(js_interpreter.nativeToPseudo(rv));
                    loop();
                })
                .catch(e => {
                    if ($scope.stopped) return;
                    $scope.observer.emit('Error', e.error || e);
                });
        };

        const MAX_ACCEPTABLE_FUNC_ARGS = 100;
        Object.defineProperty(asyncFunc, 'length', { value: MAX_ACCEPTABLE_FUNC_ARGS + 1 });
        return js_interpreter.createAsyncFunction(asyncFunc);
    }

    function initFunc(js_interpreter, scope) {
        const bot_interface = bot.getInterface();
        const { getTicksInterface, alert, prompt, sleep, console: custom_console } = bot_interface;
        const ticks_interface = getTicksInterface;

        js_interpreter.setProperty(scope, 'console', js_interpreter.nativeToPseudo(custom_console));
        js_interpreter.setProperty(scope, 'alert', js_interpreter.nativeToPseudo(alert));
        js_interpreter.setProperty(scope, 'prompt', js_interpreter.nativeToPseudo(prompt));
        js_interpreter.setProperty(scope, 'getPurchaseReference', js_interpreter.nativeToPseudo(bot_interface.getPurchaseReference));

        const pseudo_bot_interface = js_interpreter.nativeToPseudo(bot_interface);
        Object.entries(ticks_interface).forEach(([name, f]) =>
            js_interpreter.setProperty(pseudo_bot_interface, name, createAsync(js_interpreter, f))
        );

        js_interpreter.setProperty(
            pseudo_bot_interface,
            'start',
            js_interpreter.nativeToPseudo((...args) => {
                const { start } = bot_interface;
                if (shouldRestartOnError(bot)) $scope.startState = js_interpreter.takeStateSnapshot();
                start(...args);
            })
        );

        js_interpreter.setProperty(pseudo_bot_interface, 'purchase', createAsync(js_interpreter, bot_interface.purchase));
        js_interpreter.setProperty(pseudo_bot_interface, 'sellAtMarket', createAsync(js_interpreter, bot_interface.sellAtMarket));
        js_interpreter.setProperty(scope, 'Bot', pseudo_bot_interface);
        js_interpreter.setProperty(
            scope,
            'watch',
            createAsync(js_interpreter, watchName => {
                const { watch } = bot.getInterface();
                if (timeMachineEnabled(bot)) {
                    const snapshot = interpreter.takeStateSnapshot();
                    if (watchName === 'before') $scope.beforeState = snapshot;
                    else $scope.duringState = snapshot;
                }
                return watch(watchName);
            })
        );
        js_interpreter.setProperty(scope, 'sleep', createAsync(js_interpreter, sleep));
    }

    async function stop() {
        if (stopPromise) return stopPromise;

        stopPromise = (async () => {
            api_base.is_stopping = true;
            try {
                const global_timeouts = globalObserver.getState('global_timeouts') ?? [];
                const timeoutEntries = Object.entries(global_timeouts);
                const is_timeouts_cancellable = timeoutEntries.every(([, timeout]) => timeout?.is_cancellable !== false);

                if (!bot.tradeEngine.contractId && is_timeouts_cancellable) {
                    timeoutEntries.forEach(([, timeout]) => {
                        const handle = timeout?.handle ?? timeout?.timer ?? timeout;
                        if (handle != null) clearTimeout(handle);
                    });
                    await terminateSession();
                } else if (
                    bot.tradeEngine.isSold === false &&
                    !$scope.is_error_triggered &&
                    isMultiplierContract(bot?.tradeEngine?.data?.contract?.contract_type ?? '')
                ) {
                    await new Promise(resolve => {
                        let timeout_id;
                        const onContractStatus = contractStatus => {
                            if (contractStatus.id !== 'contract.sold') return;
                            clearTimeout(timeout_id);
                            globalObserver.unregister('contract.status', onContractStatus);
                            resolve();
                        };
                        globalObserver.register('contract.status', onContractStatus);
                        timeout_id = setTimeout(() => {
                            globalObserver.unregister('contract.status', onContractStatus);
                            console.warn('[DBot] Timed out waiting for contract.sold during stop; terminating session safely.');
                            resolve();
                        }, STOP_CONTRACT_WAIT_TIMEOUT_MS);
                    });
                    await terminateSession();
                } else {
                    await terminateSession();
                }
            } catch (error) {
                console.error('[DBot] Stop lifecycle error; forcing safe termination:', error);
                try {
                    await terminateSession();
                } catch (terminationError) {
                    console.error('[DBot] Forced termination also failed:', terminationError);
                }
            } finally {
                api_base.is_stopping = false;
            }
        })();

        try {
            await stopPromise;
        } finally {
            stopPromise = null;
        }
    }

    async function terminateSession() {
        if (terminationPromise) return terminationPromise;

        terminationPromise = (async () => {
            $scope.stopped = true;
            $scope.is_error_triggered = false;
            globalObserver.emit('bot.stop');
            const { ticksService } = $scope;

            try {
                api_base.clearSubscriptions();
            } catch (error) {
                console.warn('[DBot] Subscription cleanup warning during stop:', error);
            }

            try {
                await ticksService.unsubscribeFromTicksService();
            } catch (error) {
                console.warn('[DBot] Tick-service cleanup warning during stop:', error);
            }
        })();

        try {
            await terminationPromise;
        } finally {
            terminationPromise = null;
        }
    }

    async function unsubscribeFromTicksService() {
        const { ticksService } = $scope;
        try {
            await ticksService.unsubscribeFromTicksService();
        } catch (e) {
            console.warn('[DBot] Tick-service unsubscribe warning:', e);
        }
    }

    function run(code) {
        return new Promise((resolve, reject) => {
            const onError = e => {
                if ($scope.stopped) return;
                if (e.code === 'InvalidToken') {
                    globalObserver.emit('client.invalid_token');
                    return;
                }
                if (shouldStopOnError(bot, e?.code)) {
                    globalObserver.emit('ui.log.error', e.message);
                    globalObserver.emit('bot.click_stop');
                    return;
                }

                $scope.is_error_triggered = true;
                if (!shouldRestartOnError(bot, e.code) || !botStarted(bot)) {
                    reject(e);
                    return;
                }

                globalObserver.emit('Error', e);
                const { initArgs, tradeOptions } = bot.tradeEngine;
                terminateSession();
                init();
                $scope.observer.register('Error', onError);
                bot.tradeEngine.init(...initArgs);
                bot.tradeEngine.start(tradeOptions);
                const canRestoreState = $scope.startState && interpreter?.restoreStateSnapshot instanceof Function;
                if (canRestoreState) revert($scope.startState);
            };

            $scope.observer.register('Error', onError);
            interpreter = new JSInterpreter(code, initFunc);
            onFinish = resolve;
            loop();
        });
    }

    return { stop, run, terminateSession, bot, unsubscribeFromTicksService };
};
export default Interpreter;

export const createInterpreter = () => new Interpreter();

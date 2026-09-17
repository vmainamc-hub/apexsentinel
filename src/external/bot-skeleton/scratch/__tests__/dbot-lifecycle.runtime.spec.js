jest.mock('../../constants', () => ({ save_types: { UNSAVED: 'UNSAVED' } }));
jest.mock('../../constants/config', () => ({ config: () => ({ default_file_name: 'test' }) }));

const mockApiBase = {
    is_stopping: false,
    setIsRunning: jest.fn(),
};
jest.mock('../../services/api/api-base', () => ({ api_base: mockApiBase }));
jest.mock('../../services/api/api-helpers', () => ({
    setInstance: jest.fn(),
    instance: {},
}));

const mockCreatedInterpreters = [];
jest.mock('../../services/tradeEngine/utils/interpreter', () => ({
    __esModule: true,
    default: jest.fn(() => {
        let resolveStop;
        const stopPromise = new Promise(resolve => {
            resolveStop = resolve;
        });
        const interpreter = {
            run: jest.fn(() => Promise.resolve()),
            stop: jest.fn(() => {
                mockApiBase.is_stopping = true;
                return stopPromise;
            }),
            bot: {
                tradeEngine: {
                    checkTicksPromiseExists: jest.fn(() => true),
                    watchTicks: jest.fn(() => Promise.resolve()),
                },
            },
            __resolveStop: resolveStop,
        };
        mockCreatedInterpreters.push(interpreter);
        return interpreter;
    }),
}));

jest.mock('../../utils', () => ({
    compareXml: jest.fn(),
    observer: { emit: jest.fn() },
}));
jest.mock('../../utils/local-storage', () => ({
    getSavedWorkspaces: jest.fn(() => Promise.resolve([])),
    saveWorkspaceToRecent: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../utils/workspace', () => ({ isDbotRTL: jest.fn(() => false) }));
jest.mock('../xml/main.xml', () => '<xml />');
jest.mock('../accumulators-proposal-handler', () => ({ forgetAccumulatorsProposalRequest: jest.fn() }));
jest.mock('../blockly', () => ({ loadBlockly: jest.fn(() => Promise.resolve()) }));
jest.mock('../dbot-store', () => ({ setInstance: jest.fn(), instance: {} }));
jest.mock('../utils', () => ({
    isAllRequiredBlocksEnabled: jest.fn(() => true),
    updateDisabledBlocks: jest.fn(),
    validateErrorOnBlockDelete: jest.fn(),
}));

const Interpreter = require('../../services/tradeEngine/utils/interpreter').default;
const DBot = require('../dbot').default;

describe('DBot runtime lifecycle: Run → Stop → Run → Stop', () => {
    beforeEach(() => {
        mockApiBase.is_stopping = false;
        mockApiBase.setIsRunning.mockClear();
        mockCreatedInterpreters.length = 0;
        Interpreter.mockClear();
    });

    test('a new Run survives a previous Stop and repeated Stop is single-flight', async () => {
        const dbot = new DBot();
        dbot.generateCode = jest.fn(() => 'runtime-test-code');
        dbot.interpreter = Interpreter();

        dbot.runBot();
        const firstInterpreter = dbot.interpreter;
        expect(firstInterpreter.run).toHaveBeenCalledWith('runtime-test-code');
        expect(dbot.is_bot_running).toBe(true);

        const firstStop = dbot.stopBot();
        const repeatedFirstStop = dbot.stopBot();
        expect(repeatedFirstStop).toBe(firstStop);
        expect(firstInterpreter.stop).toHaveBeenCalledTimes(1);
        expect(mockApiBase.is_stopping).toBe(true);

        dbot.runBot();
        const secondInterpreter = dbot.interpreter;
        expect(secondInterpreter).not.toBe(firstInterpreter);
        expect(secondInterpreter.run).toHaveBeenCalledWith('runtime-test-code');
        expect(dbot.is_bot_running).toBe(true);
        expect(mockApiBase.is_stopping).toBe(false);

        firstInterpreter.__resolveStop();
        await firstStop;
        expect(dbot.interpreter).toBe(secondInterpreter);
        expect(secondInterpreter.stop).not.toHaveBeenCalled();
        expect(dbot.is_bot_running).toBe(true);

        const secondStop = dbot.stopBot();
        expect(secondInterpreter.stop).toHaveBeenCalledTimes(1);
        secondInterpreter.__resolveStop();
        await secondStop;

        expect(dbot.interpreter).not.toBe(secondInterpreter);
        expect(dbot.stop_promise).toBeNull();
    });
});

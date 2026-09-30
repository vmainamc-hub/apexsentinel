export const getSymbolRequestField = symbol => ({ underlying_symbol: symbol });

export const removeUndefinedFields = fields =>
    Object.entries(fields).reduce((cleaned, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') cleaned[key] = value;
        return cleaned;
    }, {});


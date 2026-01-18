export const toMinorUnit = (amount: number | string): bigint => {
    //db format
    const num = Number(amount);
    if (isNaN(num)) throw new Error('Invalid money amount');
    return BigInt(Math.round(num * 100));
};

export const toMajorUnit = (amount: bigint | string): number => {
    //user format
    return Number(amount) / 100;
};

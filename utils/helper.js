export async function runParallelLimited(items, limit, taskFn) {
    const results = [];
    let index = 0;

    const workers = new Array(limit).fill(null).map(async () => {
        while (index < items.length) {
            const i = index++;
            try {
                const result = await taskFn(items[i], i);
                results[i] = result;
            } catch (err) {
                results[i] = { error: err.message };
            }
        }
    });

    await Promise.all(workers);
    return results;
}
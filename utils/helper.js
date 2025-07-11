
export function formatReadableTimeString(timeStr) {
    const date = new Date(timeStr);
    if (isNaN(date)) return 'Invalid date';

    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
}
import { PI_PUBLIC_ADDRESS_GROUPED } from "./fn.js";

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

export function timeAgoOrInString(timeStr) {
    const date = new Date(timeStr);
    if (isNaN(date)) return 'Invalid date';

    const now = Date.now();
    const diff = Math.floor((date.getTime() - now) / 1000); // future is positive, past is negative
    const absDiff = Math.abs(diff);

    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 },
    ];

    for (const { label, seconds } of intervals) {
        const count = Math.floor(absDiff / seconds);
        if (count >= 1) {
            const timeStr = `${count} ${label}${count > 1 ? 's' : ''}`;
            return diff > 0 ? `in ${timeStr}` : `${timeStr} ago`;
        }
    }

    return 'just now';
}

export function splitMessage(message, maxLength = 4096) {
    const result = [];
    let current = '';

    for (const line of message.split('\n')) {
        if ((current + line).length > maxLength) {
            result.push(current);
            current = '';
        }
        current += line + '\n';
    }

    if (current) result.push(current);
    return result;
}

export function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size).join(' '));
  }
  return result;
}

export function getRandomAddress() {
    return PI_PUBLIC_ADDRESS_GROUPED[
        Math.floor(Math.random() * PI_PUBLIC_ADDRESS_GROUPED.length)
    ];
}


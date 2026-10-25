/**
 * Utility to resolve media URLs (images, videos) for local and production environments.
 */
export const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const backendUrl = isLocalhost ? 'http://localhost:3003' : window.location.origin;
    return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

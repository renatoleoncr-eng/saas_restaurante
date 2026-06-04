import { useEffect, useRef } from 'react';

/**
 * Custom hook to close modals/overlays using the PWA/browser back button or gesture.
 * 
 * @param {boolean} isOpen - If true, intercepts back button navigation.
 * @param {function} onClose - Callback executed when the back button/gesture is triggered.
 */
export function useModalBackHandler(isOpen, onClose) {
    const onCloseRef = useRef(onClose);
    
    // Maintain a mutable reference to onClose to avoid triggering effect runs when the callback changes reference.
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;

        // Unique identifier for this modal instance
        const stateId = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Push a dummy state to browser history
        window.history.pushState({ modalId: stateId }, '');

        const handlePopState = (event) => {
            // When popstate is fired, the browser has already popped the state.
            onCloseRef.current();
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);

            // If the modal is closing programmatically (e.g. clicking 'X' or submit button),
            // we must pop the history state we pushed to keep history synchronized.
            if (window.history.state?.modalId === stateId) {
                window.history.back();
            }
        };
    }, [isOpen]);
}

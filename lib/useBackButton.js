import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { isNativeApp } from '@/lib/dataSource';

// Runs `onBack` when Android's back button is pressed while `active` is true.
// While no handler is active, the back button keeps its default behaviour
// (closing the app).
export function useBackButton(active, onBack) {
    const onBackRef = useRef(onBack);
    onBackRef.current = onBack;

    useEffect(() => {
        if (!active || !isNativeApp()) return;

        let listener = null;
        let cancelled = false;
        App.addListener('backButton', () => onBackRef.current()).then(handle => {
            if (cancelled) handle.remove();
            else listener = handle;
        });
        return () => {
            cancelled = true;
            if (listener) listener.remove();
        };
    }, [active]);
}

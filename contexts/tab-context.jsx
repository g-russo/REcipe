import React, { createContext, useContext, useRef, useCallback } from 'react';

const TabContext = createContext({
    subscribe: () => () => { },
    emit: () => { },
});

export const TabProvider = ({ children }) => {
    const listeners = useRef([]);

    const subscribe = useCallback((listener) => {
        listeners.current.push(listener);
        return () => {
            listeners.current = listeners.current.filter(l => l !== listener);
        };
    }, []);

    const emit = useCallback((event) => {
        listeners.current.forEach(listener => listener(event));
    }, []);

    return (
        <TabContext.Provider value={{ subscribe, emit }}>
            {children}
        </TabContext.Provider>
    );
};

export const useTabContext = () => useContext(TabContext);

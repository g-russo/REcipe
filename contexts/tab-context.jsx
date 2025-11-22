import React, { createContext, useContext, useRef, useCallback, useState } from 'react';

const TabContext = createContext({
    subscribe: () => () => { },
    emit: () => { },
    isUploadModalVisible: false,
    toggleUploadModal: () => { },
    hideUploadModal: () => { },
    showUploadModal: () => { },
});

export const TabProvider = ({ children }) => {
    const listeners = useRef([]);
    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);

    const subscribe = useCallback((listener) => {
        listeners.current.push(listener);
        return () => {
            listeners.current = listeners.current.filter(l => l !== listener);
        };
    }, []);

    const emit = useCallback((event) => {
        listeners.current.forEach(listener => listener(event));
    }, []);

    const toggleUploadModal = useCallback(() => {
        setIsUploadModalVisible(prev => !prev);
    }, []);

    const hideUploadModal = useCallback(() => {
        setIsUploadModalVisible(false);
    }, []);

    const showUploadModal = useCallback(() => {
        setIsUploadModalVisible(true);
    }, []);

    return (
        <TabContext.Provider value={{
            subscribe,
            emit,
            isUploadModalVisible,
            toggleUploadModal,
            hideUploadModal,
            showUploadModal
        }}>
            {children}
        </TabContext.Provider>
    );
};

export const useTabContext = () => useContext(TabContext);

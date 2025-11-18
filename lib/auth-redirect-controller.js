let suppressRedirect = false;

export const setSuppressRedirect = (value) => {
    suppressRedirect = !!value;
};

export const getSuppressRedirect = () => suppressRedirect;

export default {
    setSuppressRedirect,
    getSuppressRedirect,
};

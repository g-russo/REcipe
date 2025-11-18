export const AVATAR_OPTIONS = [
    {
        id: 'burger',
        label: 'Burger',
        source: require('../../assets/profile-avatar/burger.png'),
    },
    {
        id: 'donut',
        label: 'Donut',
        source: require('../../assets/profile-avatar/donut.png'),
    },
    {
        id: 'fries',
        label: 'Fries',
        source: require('../../assets/profile-avatar/fries.png'),
    },
    {
        id: 'hotdog',
        label: 'Hotdog',
        source: require('../../assets/profile-avatar/hotdog.png'),
    },
    {
        id: 'milkshake',
        label: 'Milkshake',
        source: require('../../assets/profile-avatar/milkshake.png'),
    },
    {
        id: 'pizza',
        label: 'Pizza',
        source: require('../../assets/profile-avatar/pizza.png'),
    },
];

export const getAvatarSource = (avatarId) => {
    const option = AVATAR_OPTIONS.find((item) => item.id === avatarId);
    return option ? option.source : null;
};

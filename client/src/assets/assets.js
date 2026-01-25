// 1. استيراد الصور بصيغة WebP (تأكد إنك حولتهم وغيرت أسماء الملفات في الفولدر)
import logo from './logoMain.webp';
import sample_cover from './sample_cover.webp'; // لو حولته
import sample_profile from './sample_profile.webp'; // لو حولته
import group_users from './group_users.png'; // لو صغير سيبه، لو كبير حوله
import sponsored_img from './sponsored_img.png';

// مكتبة الأيقونات (تمام زي الفل)
import { Home, MessageCircle, Search, UserIcon, Users } from 'lucide-react';

export const assets = {
    logo,
    sample_cover,
    sample_profile,
    group_users,
    sponsored_img
};

export const menuItemsData = [
    { to: '/', label: 'Feed', Icon: Home },
    { to: '/messages', label: 'Messages', Icon: MessageCircle },
    { to: '/connections', label: 'Connections', Icon: Users },
    { to: '/discover', label: 'Discover', Icon: Search },
    { to: '/profile', label: 'Profile', Icon: UserIcon },
];

// بيانات اليوزر (عنصر واحد بس عشان الصفحة متضربش)
export const dummyUserData = {
    _id: "test_user_id",
    email: "user@example.com",
    full_name: "Test User",
    username: "test_user",
    bio: "Developer at Flurry 🚀",
    profile_picture: sample_profile,
    cover_photo: sample_cover,
    location: "Egypt",
    followers: [],
    following: [],
    connections: [],
    posts: [],
    is_verified: true,
};

// 2. تفريغ الداتا التقيلة (عشان السرعة) 🚀
export const dummyStoriesData = [];
export const dummyPostsData = [];
export const dummyRecentMessagesData = [];
export const dummyMessagesData = [];
export const dummyConnectionsData = [];
export const dummyFollowersData = [];
export const dummyFollowingData = [];
export const dummyPendingConnectionsData = [];
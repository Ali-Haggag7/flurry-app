import { Home, Search, MessageCircle, User, Settings, CirclePlus, LogOut, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { UserButton, useClerk } from '@clerk/clerk-react'

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {

    const user = ""  // استبدلها بمنطق التحقق من المستخدم
    const { signOut } = useClerk()  // دالة لتسجيل الخروج

    return (
        <>
            <div className={`w-20 h-screen fixed top-0 left-0 z-100 flex flex-col items-center
        space-y-6 bg-gradient-to-b from-[#0b0f3d] via-[#1a1f4d] to-[#3c1f7f]
        backdrop-blur-xl shadow-[0_0_30px_rgba(131,58,180,0.6)] border-r border-purple-500/20
        transform transition-transform duration-300 py-6 gap-6 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}`}>
                <div className="flex flex-col space-y-10">

                    <Link onClick={() => setSidebarOpen(false)} to="/" className='p-2 rounded-full transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]'>
                        <Home size={24} className='text-indigo-400 hover:text-indigo-300 transition-all' />
                    </Link>

                    <Link onClick={() => setSidebarOpen(false)} to="/search" className='p-2 rounded-full transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]'>
                        <Search size={24} className='text-pink-400 hover:text-pink-300 transition-all' />
                    </Link>

                    <Link onClick={() => setSidebarOpen(false)} to="/messages" className='p-2 rounded-full transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]'>
                        <MessageCircle size={24} className='text-yellow-400 hover:text-yellow-300 transition-all' />
                    </Link>

                    <Link onClick={() => setSidebarOpen(false)} to="/profile" className='p-2 rounded-full transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]'>
                        <User size={24} className='text-cyan-400 hover:text-cyan-300 transition-all' />
                    </Link>

                    <Link onClick={() => setSidebarOpen(false)} to="/settings" className='p-2 rounded-full transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]'>
                        <Settings size={24} className='text-purple-400 hover:text-purple-300 transition-all' />
                    </Link>

                    <Link onClick={() => setSidebarOpen(false)} to="/connections" className='p-2 rounded-full transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.9)]'>
                        <Users size={24} className='text-green-400 hover:text-green-300 transition-all' />
                    </Link>
                </div>

                <Link onClick={() => setSidebarOpen(false)} to="/create-post" className='flex items-center
                    justify-center py-2.5 w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600
                    rounded-full hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition shadow-[0_0_20px_rgba(0,255,255,0.9)]'>
                    <CirclePlus className='w-6 h-6 text-white' />
                </Link>

                {/* User Actions */}
                <div className="mt-auto flex flex-col items-center gap-4 mb-2">
                    <UserButton
                        appearance={{
                            elements: {
                                userButtonAvatarBox: 'w-10 h-10 rounded-full shadow-[0_0_20px_rgba(0,255,255,0.7)] border border-purple-400',
                            }
                        }}
                    />

                    <LogOut onClick={() => signOut()}
                        className='w-6 h-6 text-gray-300 hover:text-white transition cursor-pointer
                    shadow-[0_0_15px_rgba(255,0,255,0.7)] hover:shadow-[0_0_25px_rgba(255,0,255,1)] rounded-full p-1' />
                </div>

            </div>
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-30 sm:hidden"
                    onClick={() => setSidebarOpen(false)}></div>
            )}
        </>
    )
}

export default Sidebar
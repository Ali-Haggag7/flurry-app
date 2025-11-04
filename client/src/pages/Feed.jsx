import Loading from "../components/Loading"
import logo from "../assets/logo.png"
import { Bell } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import StoriesBar from "../components/StoriesBar"
import RecentMessages from "../components/ResentMessages"

const Feed = () => {

    const [feeds, setFeeds] = useState([])
    const [loading, setLoading] = useState(false)

    const navigate = useNavigate()

    return !loading ? (
        <div className=" h-full  no-scrollbar py-10 xl:pr-5 flex flex-col items-center 
        bg-gradient-to-br from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f] text-white relative">
            <div className="w-[90%] flex justify-between items-center p-4 absolute top-1 z-50 right-4 rounded-3xl">  {/*---------- box 1 ----------*/}
                <img src={logo} alt="logo" className="h-10 mr-3 hidden sm:block animate-pulse" /> {/* Logo image */}

                <div className="flex-1 mx-4 sm:ml-65 max-w-md">  {/* Search bar container */}
                    <input type="text" placeholder="ابحث هنا..." className="w-full bg-white/5 border rounded-3xl
                    border-purple-500/30 text-white p-3 placeholder-purple-300 focus:outline-none
                    focus:ring-2 focus:ring-purple-500/40 transition-all duration-200"/>
                </div>

                <div onClick={() => navigate('/notifications')} className="relative cursor-pointer p-3 rounded-full bg-gradient-to-br
                from-purple-600 to-pink-500 shadow-[0_0_20px_rgba(255,0,255,0.5)] hover:scale-110 transition-transform duration-200">
                    <Bell className="w-6 h-6 text-white animate-pulse" />
                    <span className="absolute top-0 right-0 bg-red-500 w-3.5 h-3.5 rounded-full" />
                </div>  {/* Notification bell icon */}
            </div>


            <div className="flex items-start justify-center xl:gap-8 w-full mt-20">  {/*---------- box 2 ----------*/}
                <div className="w-full max-w-2xl">
                    <StoriesBar />
                    <div className="p-4 space-y-6">
                        {/* post card */}
                        {feeds.map((post) => (
                            <div key={post._id}>
                                {/* PostCard component */}
                                <PostCard post={post} className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-[0_0_20px_rgba(255,0,255,0.2)]
                                hover:scale-105 hover:shadow-[0_0_25px_rgba(255,0,255,0.4)] transition-transform duration-300" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* الرسائل الجانبية */}
                <div className="max-xl:hidden sticky top-2">
                    <RecentMessages />
                </div>
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-600/20 via-pink-500/10
                    to-indigo-400/10 mix-blend-overlay animate-pulse-slow" >
            </div>

        </div >
    ) : (
        <Loading />
    )
}

export default Feed
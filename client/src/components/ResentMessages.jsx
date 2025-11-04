import { Link } from "react-router-dom"
import { useState, useEffect } from "react"
import moment from "moment"
import { useAuth, useUser } from "@clerk/clerk-react"
import toast from "react-hot-toast"
import { motion } from "framer-motion"


const RecentMessages = ({ viewStory, setViewStory }) => {

    const [messages, setMessages] = useState([])
    const { user } = useUser()

    return (
        <motion.div
            className={`w-72 flex flex-col text-sm absolute top-0 -right-96 
            ${viewStory ? "hidden" : "flex"} 
            bg-gradient-to-b from-[#1a1f4d]/80 via-[#0f172a]/60 to-[#0b0f3b]/90 
            backdrop-blur-xl rounded-3xl shadow-[0_0_25px_rgba(131,58,180,0.5)] 
            border border-purple-500/30 overflow-hidden`}
            initial={{ x: 200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}>

            <h3 className="font-bold text-white px-4 py-3 border-b border-purple-500/30 bg-purple-900/10 backdrop-blur-md">
                Messages
            </h3>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-transparent">
                {messages.map((message, index) => (
                    <Link
                        to={`/messages/${message.from_user_id._id}`}
                        key={index}
                        className="flex items-center gap-3 px-4 py-5 hover:bg-purple-700/20 hover:shadow-[0_0_25px_rgba(131,58,180,0.5)]
                            hover:rounded-3xl transition-all duration-300"
                    >
                        <div className="relative">  {/* User profile picture */}
                            <img
                                src={message.from_user_id.profile_picture}
                                className="w-10 h-10 rounded-full ring-2 ring-purple-500 shadow-[0_0_25px_rgba(131,58,180,0.5)]"
                            />
                            {!message.seen && (  // online indicator for unseen messages
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse ring-1 ring-green-500" />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">  {/* Message info */}
                            <p className="font-semibold text-white truncate">{message.from_user_id.full_name}</p>
                            <p className="text-purple-300 text-xs truncate">
                                {message.text ? message.text : "Sent a media file"}
                            </p>
                        </div>

                        <div className="flex flex-col items-end text-xs text-purple-400">  {/* Timestamp */}
                            <span>{moment(message.createdAt).fromNow(true)}</span>
                        </div>
                    </Link>
                ))}
            </div>
        </motion.div>
    )
}
export default RecentMessages
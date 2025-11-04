import { Plus } from "lucide-react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import StoryWindow from "./StoryWindow"
import StoryPlayer from "./StoryPlayer"

const StoriesBar = () => {
    const [stories, setStories] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [viewStory, setViewStory] = useState(null)

    const fetchStories = async () => {

    }


    return (
        <>
            <div className="fixed bottom-0 left-0 w-full bg-linear-to-t from-[#0f172a]/90 via-[#1a1fd4]/50 to-[#3c1f7f]  
            backdrop-blur-lg border-t border-purple-500/20 pb-2 h-25 z-10">

                {/* Stories */}
                <div className="flex items-center overflow-x-scroll scrollbar-hide px-4 space-x-4 py-2">
                    {/* create story button */}
                    <motion.div onClick={() => setShowModal(true)}
                        className="shrink-0 sm:ml-30 mt-1 flex flex-col items-center cursor-pointer"
                        whileHover={{ scale: 1.15 }}
                        transition={{ type: "spring", stiffness: 150 }}>

                        <div className="w-14 h-14 rounded-full bg-linear-to-br from-indigo-500 to-purple-600
                            flex items-center justify-center shadow-[0_0_20px_rgba(255,0,255,0.5)]
                            hover:shadow-[0_0_35px_rgba(255,0,255,0.8)] transition-all">

                            <Plus className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-[11px] text-white mt-1 font-semibold animate-pulse">Story</p>
                    </motion.div>

                    {/* friends stories  */}
                    {stories.map((story, index) => (
                        <motion.div key={index}
                            className="flex shrink-0 flex-col mt-3 items-center cursor-pointer"
                            style={{ width: "calc(100% / 6)" }}
                            whileHover={{ scale: 1.15 }} transition={{ type: "spring", stiffness: 120 }}>
                            <img src={story.user.profilePicture} className="w-14 h-14 rounded-full ring-2 ring-purple-400
                            object-cover shadow-[0_0_20px_rgba(255,0,255,0.4)]"
                                onClick={() => setViewStory(story)} />
                            <p className="text-[11px] text-white mt-1 truncate max-w-14">{story.user.username || "User"}</p>
                        </motion.div>
                    ))}
                </div>

                {/* create story modal */}
                {showModal && <StoryWindow setShowModal={setShowModal} fetchStories={fetchStories} />}
                {/* story window */}

                {/* fullscreen story viewer */}  {/*-------------------- main box 2 ---------------------*/}  {/* box 3 */}
                {viewStory && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}>
                        {/* story player */}
                        <StoryPlayer viewStory={viewStory} setViewStory={setViewStory} />

                        {/* recent messages */}
                        <RecentMessages viewStory={viewStory} setViewStory={setViewStory} />
                    </motion.div>
                )}
            </div>
        </>
    )
}

export default StoriesBar
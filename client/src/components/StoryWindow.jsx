import { useAuth } from "@clerk/clerk-react"
import { ArrowLeft, Sparkle, TextIcon, Upload } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"



const handleMediaUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
        setMedia(file)
        setPreviewUrl(URL.createObjectURL(file))
    }
}

const handleCreateStory = async () => {
    // Logic for creating a story
}



const StoryWindow = ({ setShowModal }) => {

    const bgColors = ["#4f46e5", "#7c3aed", "#db2777", "#e11d48", "#ca8a04", "#0d9488"]

    const [mode, setMode] = useState("text")
    const [background, setBackground] = useState(bgColors[0])
    const [media, setMedia] = useState(null)
    const [text, setText] = useState("text")
    const [previewUrl, setPreviewUrl] = useState(null)

    return (
        <div className="fixed inset-0 z-999999 min-h-screen bg-black/80 backdrop-blur text-white 
        flex items-end justify-center">
            <div className="w-full max-w-2xl h-[90vh] bg-black/60 rounded-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="border-b border-white/20 p-4 flex items-center justify-between">
                    <button className="text-gray-400 hover:text-white" onClick={() => setShowModal(false)}>
                        <ArrowLeft />
                    </button>
                    <h2 className="text-lg font-semibold">Create a Story</h2>
                    <span className="w-10">

                    </span>
                </div>

                {/* text or image area */}
                <div className="rounded-lg h-96 flex items-center justify-center relative" style={{ backgroundColor: background }}>
                    {mode === "text" && (
                        <textarea
                            className="w-full h-full bg-transparent text-white p-4 resize-none outline-none"
                            placeholder="What's on your mind?"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                        />
                    )}
                    {mode === "media" && previewUrl && (
                        media?.type.startsWith("image/") ? (
                            <img src={previewUrl} alt="Story Media" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <video src={previewUrl} controls className="max-w-full max-h-full object-contain" />
                        )
                    )}
                </div>

                {/* color picker */}
                <div className="flex gap-2 mt-4">
                    {
                        bgColors.map((color, index) => (
                            <button key={index} className="w-6 h-6 rounded-full ring cursor-pointer"
                                style={{ backgroundColor: color }}
                                onClick={() => setBackground(color)} />
                        ))
                    }
                </div>

                {/* Mode Switcher */}
                <div className="flex gap-4 mt-4">
                    <button className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md
                    ${mode === "text" ? "bg-white text-black" : "bg-zinc-800"}`}
                        onClick={() => { setMode("text"), setMedia(null), setPreviewUrl(null) }}>
                        <TextIcon className="w-4 h-4" />
                    </button>
                    <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded cursor-pointer
                    ${mode === "media" ? "bg-white text-black" : "bg-zinc-800 :hover:bg-zinc-700"}`}>
                        <input type="file" accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />
                        <Upload className="w-4 h-4" /> Photo/Video
                    </label>
                </div>

                {/* create story button */}
                <button onClick={() => toast.promise(handleCreateStory(), {
                    loading: 'Posting your story...',
                    success: 'Story posted successfully!',
                    error: 'Failed to post story.'
                })} className="flex items-center justify-center gap-2 py-2 mt-4 w-full rounded-md text-white
                bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700
                active:scale-95 transition cursor-pointer">
                    <Sparkle className="w-5 h-5" /> Create Story
                </button>

            </div>
        </div>
    )
}

export default StoryWindow
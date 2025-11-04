import { useState, useEffect } from "react"
import { BadgeCheck, X } from "lucide-react"

const StoryPlayer = ({ viewStory, setViewStory }) => {

    const handleClose = () => {
        setViewStory(null)
    }

    const renderContent = () => {
        switch (viewStory.mediaType) {
            case "image":
                return (
                    <img src={viewStory.mediaUrl} alt="Story Image" className="max-w-full max-h-screen object-contain" />
                );
            case "video":
                return (
                    <video src={viewStory.mediaUrl} onEnded={() => setViewStory(null)}
                        controls autoPlay className=" max-h-screen" />
                );
            case "text":
                return (
                    <div className="p-8 rounded-lg shadow-lg w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: viewStory.background_color }}>
                        <p className="text-white text-2xl sm:text-4xl font-semibold text-center whitespace-pre-wrap">
                            {viewStory.textContent}
                        </p>
                    </div>
                )
            default:
                return null;
        }
    }

    const [progress, setProgress] = useState(0);
    useEffect(() => {
        let interval;
        if (viewStory && viewStory.mediaType !== "video") {  // Only for images and text
            setProgress(0);
            const duration = 5000; // 5 seconds for images and text
            const increment = 100; // Update every 100ms
            let elapsed = 0;

            interval = setInterval(() => {  // Update progress
                elapsed += increment;
                setProgress((elapsed / duration) * 100);
                if (elapsed >= duration) {
                    clearInterval(interval);
                    setViewStory(null);
                }
            }, increment);
        }

        return () => clearInterval(interval);
    }, [viewStory, setViewStory]);


    return (
        <div className="fixed inset-0 h-screen bg-black bg-opacity-90 flex items-center justify-center"
            style={{ backgroundColor: viewStory.mediaType === "text" ? viewStory.background_color : "#000000" }}>  {/* Story Player Container */}

            <div className="absolute top-0 left-0 w-full h-1 bg-gray-700">
                <div className="h-full bg-white transition-all duration-100 linear" style={{ width: `${progress}%` }}></div>
            </div>

            <div className="absolute top-4 left-24 flex items-center space-x-3 p-2 px-4 sm:p-4 sm:px-8 backdrop-blur-2xl rounded bg-black/50">
                <img src={viewStory.user?.profile_picture} alt="Profile" className="size-7 sm:size-8 rounded-full object-cover border border-white" />
                <div className="text-white font-medium flex items-center gap-1.5">
                    <span>{viewStory.user?.full_name}</span>
                    <span className="text-gray-400">{viewStory.createdAt}</span>
                    <BadgeCheck size={18} />
                </div>
            </div>

            <button onClick={handleClose} className="absolute top-4 right-4 text-white text-3xl font-bold focus:outline-none">
                <X className="w-8 h-8 hover:scale-110 transition cursor-pointer" />
            </button>

            <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
                {renderContent()}
            </div>

        </div>
    )
}

export default StoryPlayer
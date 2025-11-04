import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, SendHorizontal, Loader2 } from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";

const PostDetails = () => {

    const navigate = useNavigate()

    const [post, setPost] = useState(null)
    const [loading, setLoading] = useState(true)
    const [commentText, setCommentText] = useState("")
    const [submitting, setSubmitting] = useState(false)

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-500 mr-2" /> Loading post...
            </div>
        )
    }

    if (!post) return <p className="text-center text-gray-400">Post Not Found</p>

    return (
        <div className="min-h-screen bg-[#0f172a] text-white">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#182034] px-4 py-3 flex items-center gap-3 shadow-md">
                <ArrowLeft onClick={() => navigate(-1)} className="w-6 h-6 cursor-pointer
                hover:text-blue-400 transition" />
                <h1 className="text-lg font-semibold ml-20">Post Details</h1>
            </div>

            {/* Post Content */}
            <div className="max-w-2xl mx-auto p-4 space-y-4">
                {/* Post Header */}
                <div className="bg-[#182034] p-4 rounded-xl shadow-lg space-y-3">
                    <div className="flex items-center gap-3">
                        <img src={post.user?.profile_picture || ""} alt="" className="w-10 h-10 rounded-full border border-gray-600" />
                        <div>
                            <p className="font-semibold">{post.user?.full_name}</p>
                            <span className="text-sm text-gray-400">@{post.user?.username || ""} · {moment(post.createdAt).fromNow()}</span>
                        </div>
                    </div>
                </div>

                {/* Post Content */}
                <p className="text-gray-200 whitespace-pre-line">{post.content}</p>
                {
                    post.image_urls?.length > 0 && (
                        <div className={`grid gap-2 ${post.image_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                            {post.image_urls.map((image, index) => (
                                <img key={index} src={image} alt="" className="w-full h-full object-cover rounded-xl" />
                            ))}
                        </div>
                    )
                }
            </div>

            {/* Comments Section */}
            <div className="bg-[#182034] rounded-xl shadow-lg p-4">
                <h2 className="text-lg font-semibold mb-3">
                    💬 Comments
                </h2>
                {
                    (!post.comments || post.comments.length === 0) ? (
                        <p className="text-gray-400">No comments yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {post.comments?.map((comment, index) => (
                                <div key={index} className="flex items-start gap-3 bg-[#0f172a] p-2 rounded-lg mb-3">
                                    <img src={comment.user?.profile_picture || ""} alt="" className="w-8 h-8 rounded-full border border-gray-600" />
                                    <div>
                                        <p className="text-sm">
                                            {comment.user?.full_name}
                                            <span className="text-xl text-gray-400">@{comment.user?.username || ""}</span>
                                        </p>
                                        <p className="text-gray-200 text-sm whitespace-pre-line">
                                            {comment.content}
                                            <span className="text-xs text-gray-400"> · {moment(comment.createdAt).fromNow()}</span>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                }
            </div>

            {/* Comment Input */}
            <div className="bg-[#182034] rounded-xl shadow-lg p-4 mt-4">
                <h2 className="text-lg font-semibold mb-3">
                    📝 Comment
                </h2>
                <div className="flex items-center gap-3">
                    <img src={user.profile_picture || ""} alt="" className="w-8 h-8 rounded-full border border-gray-600" />
                    <input
                        type="text"
                        placeholder="Write your comment..."
                        className="flex-1 bg-[#0f172a] text-white rounded-lg p-2"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                    <button
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                        onClick={handleAddComment}
                        disabled={!comment}
                    >
                        Comment
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PostDetails
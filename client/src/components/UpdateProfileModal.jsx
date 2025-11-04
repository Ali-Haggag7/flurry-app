import toast from "react-hot-toast";
import { Pencil } from "lucide-react";
import { useState } from "react";
import sample_profile from "../assets/sample_profile.jpg"
import sample_cover from "../assets/sample_cover.jpg"

const UpdateProfileModal = ({ setShowEdit }) => {
    const [user, setUser] = useState({
        _id: "u1",
        username: "John Doe",
        full_name: "John Doe",
        profile_picture: sample_profile,
        cover_photo: sample_cover,
        bio: "This is my bio",
        isFollowed: false,
        isBlocked: false,
        location: "New York, USA"
    });
    const [editForm, setEditForm] = useState({
        profile_picture: user.sample_profile,
        cover_photo: user.sample_cover,
        full_name: user.full_name,
        username: user.username,
        location: user.location,
        bio: user.bio
    })

    const handleSaveProfile = () => {

    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-md"> {/* overlay */}
            <div className="flex items-start sm:items-center justify-center min-h-screen py-8 px-4">  {/* container */}
                <div className="w-full max-w-2xl mx-auto relative bg-gradient-to-br from-gray-900/85
                            via-purple-900/85 to-black/85 border border-purple-500/20 rounded-3xl p-6 
                            sm:p-8 shadow-[0_0_40px_rgba(168,85,247,0.6)] max-h-[85vh] overflow-y-auto">  {/* modal */}

                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r 
            from-purple-400 to-pink-500 mb-6 text-center tracking-wide"> Edit Profile</h1>

                    <form className="space-y-6"
                        onSubmit={(e) => toast.promise(handleSaveProfile(e), { loading: "Saving..." })}> {/* form  */}

                        {/* Profile Picture */}
                        <div className="flex flex-col items-center">
                            <label htmlFor="profile_picture" className="group cursor-pointer relative">  {/* profile picture label */}
                                <input hidden type="file" accept="image/*" id="profile_picture"
                                    onChange={(e) => setEditForm({ ...editForm, profile_picture: e.target.files[0] })} />  {/* hidden file input */}

                                <img src={editForm.profile_picture
                                    ? URL.createObjectURL(editForm.profile_picture)
                                    : user.profile_picture || "default.png"}
                                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full mx-auto object-cover border-4 border-purple-500
                                    shadow-[0_0_30px_rgba(168,85,247,0.75)]" />  {/* profile picture */}

                                <div className="absolute inset-0 hidden group-hover:flex items-center justify-center 
                                    rounded-full bg-black/40">
                                    <Pencil className="w-6 h-6 text-white" />  {/* edit icon */}
                                </div>
                            </label>
                            <span></span>
                        </div>

                        {/* Cover Photo */}
                        <div className="flex flex-col items-center gap-3">  {/* cover photo container */}
                            <label htmlFor="cover_photo" className="w-full cursor-pointer group relative">  {/* cover photo label */}
                                <input hidden type="file" accept="image/*" id="cover_photo"
                                    onChange={(e) => setEditForm({ ...editForm, cover_photo: e.target.files[0] })} />  {/* hidden file input */}

                                <img src={editForm.cover_photo
                                    ? URL.createObjectURL(editForm.cover_photo)
                                    : user.cover_photo || "default.png"}
                                    className="w-full h-36 sm:h-40 rounded-xl object-cover border border-purple-400/25 shadow-lg" />  {/* cover photo */}

                                <div className="absolute inset-0 hidden group-hover:flex items-center justify-center rounded-xl bg-black/40">  {/* edit icon */}
                                    <Pencil className="w-6 h-6 text-white" />
                                </div>
                            </label>

                            <span className="text-gray-400 text-sm">Change Cover Photo</span>
                        </div>

                        {/* Inputs */}  {/* name, username, bio, email */}
                        {[
                            { label: "Full Name", type: "text", name: "full_name", value: editForm.full_name || user.full_name },
                            { label: "Username", type: "text", name: "username", value: editForm.username || user.username },
                            { label: "Location", type: "text", name: "location", value: editForm.location || user.location },
                        ].map((input) => (
                            <div key={input.value}>
                                <label htmlFor={input.name} className="block text-sm font-medium text-purple-300 mb-1">
                                    {input.value ? input.label : `${input.label} (Optional)`}
                                </label>
                                <input type={input.type} className="w-full px-4 py-3 rounded-xl bg-white/5 border 
                                    border-white/10 text-white placeholder-gray-500 focus:outline-none 
                                    focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition"
                                    placeholder={`Enter your ${input.label.toLowerCase()}`}
                                    onChange={(e) => setEditForm({ ...editForm, [input.name]: e.target.value })}
                                    value={editForm[input.name]} />
                            </div>
                        ))}

                        {/* bio */}
                        <div>
                            <label htmlFor="bio" className="block text-sm font-medium text-purple-300 mb-1">
                                Bio
                            </label>
                            <textarea rows="3" className="w-full px-4 py-3 rounded-xl bg-white/5 border 
                                border-white/10 text-white placeholder-gray-500 focus:outline-none 
                                focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition"
                                placeholder="What's your vibe? Let the world know..."
                                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                value={editForm.bio} />
                        </div>

                        {/* Save / Cancel */}
                        <div className="flex justify-end space-x-3 pt-6 pb-6">
                            <button type="button"
                                className="px-5 py-2 rounded-xl border border-gray-500 text-gray-300 hover:bg-white/10 transition cursor-pointer"
                                onClick={() => setShowEdit(false)}>Cancel</button>
                            <button type="submit"
                                className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600
                                cursor-pointer text-white font-semibold shadow-[0_0_25px_rgba(236,72,153,0.7)] hover:scale-105 transition">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UpdateProfileModal
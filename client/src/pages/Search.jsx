import { motion } from "framer-motion";
import { Search as SearchIcon } from "lucide-react";
import Loading from "../components/Loading";
import { useState } from "react";

const Search = () => {

    const [input, setInput] = useState("");
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        // if (e.key === "Enter") {
        //     setLoading(true);
        //     try {
        //         const response = await fetch(`/api/search?query=${encodeURIComponent(input)}`);
        //         const data = await response.json();
        //         setUsers(data.users);
        //     } catch (error) {
        //         console.error("Error fetching users:", error);
        //     } finally {
        //         setLoading(false);
        //     }
        // }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0b0f3b] via-[#1a1f4d] to-[#c5bfee] text-white">
            <div className="max-w-6xl mx-auto p-6">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="mb-8 text-center"
                >
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                        🌸 Discover People
                    </h1>
                    <p className="text-gray-300 mt-2">
                        Connect with amazing people and grow your magical network
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="mb-8 shadow-lg rounded-xl border border-white/20 bg-white/20 backdrop-blur-lg w-0-full md:w-3/4 mx-auto"
                >
                    <div className="p-6">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by name, username, or bio..."
                                className="w-full pl-10 sm:pl-12 py-2 rounded-xl bg-slate-900/70 border border-purple-600 text-gray-200
                                placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-300"
                                onChange={(e) => setInput(e.target.value)}
                                value={input}
                                onKeyUp={handleSearch}
                            />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1 }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                    {users.length === 0 && !loading ? (
                        <p className="text-center text-gray-400 col-span-full mt-8">
                            No users found. Try searching something else...
                        </p>
                    ) : (
                        users.map((user) => (
                            <motion.div
                                key={user.id}
                                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(255, 0, 255, 0.6)" }}
                                className="relative p-6 rounded-xl bg-white/10 border border-pink-500 backdrop-blur-lg shadow-none
                                transition-all duration-300"
                            >
                                {/* <UserCard user={user} /> */}
                            </motion.div>
                        ))
                    )}
                </motion.div>
                {loading && <Loading height="50vh" />}
            </div>
        </div>
    );
};

export default Search;
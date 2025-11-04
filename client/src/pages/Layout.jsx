import { Outlet } from "react-router-dom"
import { Menu, X } from "lucide-react"
import { useState } from "react"
import Sidebar from "../components/Sidebar"
import Loading from "../components/Loading"

const Layout = () => {

    const user = true  // استبدلها بمنطق التحقق من المستخدم
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return user ? (
        <div className="w-full flex h-screen">
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
            <div className="flex-1 bg-slate-50">
                <Outlet />
            </div>
            {sidebarOpen ?
                <X className="top-3 right-3 p-2 fixed z-100 bg-white rounded-md shadow 
            w-10 h-10 text-gray-600 sm:hidden cursor-pointer" size={30}
                    onClick={() => setSidebarOpen(false)} />
                : <Menu className=" top-3 right-3 fixed p-2 z-100 bg-[#1f2937] rounded-md shadow 
            w-10 h-10 text-gray-600  sm:hidden cursor-pointer" size={30}
                    onClick={() => setSidebarOpen(true)} />}
        </div>
    ) : (
        <Loading />
    )
}

export default Layout
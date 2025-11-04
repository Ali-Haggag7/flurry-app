import { Routes, Route } from 'react-router-dom'
import Messages from './pages/Messages'
import Chat from './pages/Chat'
import Connections from './pages/Connections'
import Profile from './pages/Profile'
import CreatePost from './pages/CreatePost'
import Search from './pages/Search'
import Settings from './pages/Settings'
import PostDetails from './pages/PostDetails'
import NotificationsPage from './pages/NotificationsPage'
import Layout from './pages/Layout'
import Feed from './pages/Feed'
import { useUser } from '@clerk/clerk-react'
import Login from './pages/Login'
import { Toaster } from 'react-hot-toast'

const App = () => {

  const { user } = useUser()

  return (
    <>
      <Toaster />
      <Routes>
        <Route path='/' element={!user ? <Login /> : <Layout />}>
          <Route index element={<Feed />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="messages/:id" element={<Chat />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/search" element={<Search />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/create-post" element={<CreatePost />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/post/:id" element={<PostDetails />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
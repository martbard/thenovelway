// src/App.js
import { Routes, Route } from 'react-router-dom';
import NavBar      from './NavBar';
import Footer      from './Footer';
import Login       from './Login';
import Register    from './Register';   // NEW
import StoryFront  from './StoryFront';
import StoryList   from './StoryList';
import StoryForm   from './StoryForm';
import StoryPage   from './StoryPage';
import ChapterPage from './ChapterPage';
import MyStories   from './MyStories';  // NEW
import StoryEdit   from './StoryEdit';  // NEW
import './App.css';

export default function App() {
  return (
    <>
      <NavBar />
      <main className="container" style={{ paddingTop: '1.25rem', paddingBottom: '2rem' }}>
        <Routes>
          <Route path="/" element={<StoryFront />} />
          <Route path="/stories" element={<StoryList />} />
          <Route path="/stories/new" element={<StoryForm />} />
          <Route path="/stories/:id" element={<StoryPage />} />
          <Route path="/stories/:id/edit" element={<StoryEdit />} />
          <Route path="/stories/:storyId/chapters/:chapterId" element={<ChapterPage />} />
          <Route path="/my" element={<MyStories />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

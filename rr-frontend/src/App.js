// src/App.js
import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import NavBar      from './NavBar';
import Footer      from './Footer';
import Login       from './Login';
import Register    from './Register';
import StoryFront  from './StoryFront';
import StoryList   from './StoryList';
import StoryForm   from './StoryForm';
import StoryPage   from './StoryPage';
import ChapterPage from './ChapterPage';
import MyStories   from './MyStories';
import StoryEdit   from './StoryEdit';
import './App.css';

// Scroll to top on route changes
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// Simple auth guard: if no access or refresh token, send to /login
function RequireAuth({ children }) {
  const location = useLocation();
  const hasToken = !!(localStorage.getItem('access') || localStorage.getItem('refresh'));
  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

export default function App() {
  return (
    <>
      <NavBar />
      <ScrollToTop />
      <main className="container" style={{ paddingTop: '1.25rem', paddingBottom: '2rem' }}>
        <Routes>
          <Route path="/" element={<StoryFront />} />
          <Route path="/stories" element={<StoryList />} />
          <Route
            path="/stories/new"
            element={
              <RequireAuth>
                <StoryForm />
              </RequireAuth>
            }
          />
          <Route path="/stories/:id" element={<StoryPage />} />
          <Route
            path="/stories/:id/edit"
            element={
              <RequireAuth>
                <StoryEdit />
              </RequireAuth>
            }
          />
          <Route path="/stories/:storyId/chapters/:chapterId" element={<ChapterPage />} />
          <Route
            path="/my"
            element={
              <RequireAuth>
                <MyStories />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

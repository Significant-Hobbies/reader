import { createBrowserRouter } from 'react-router-dom';

import RootLayout from './RootLayout';
import AboutPage from './pages/AboutPage';
import BoardListPage from './pages/BoardListPage';
import BoardPage from './pages/BoardPage';
import ExtensionPage from './pages/ExtensionPage';
import LandingPage from './pages/LandingPage';
import LibraryPage from './pages/LibraryPage';
import LoginPage from './pages/LoginPage';
import MemoryPage from './pages/MemoryPage';
import NotFoundPage from './pages/NotFoundPage';
import PrivacyPage from './pages/PrivacyPage';
import ReaderPage from './pages/ReaderPage';
import SamplePage from './pages/SamplePage';
import SharedArticlePage from './pages/SharedArticlePage';
import SharedBoardPage from './pages/SharedBoardPage';
import WelcomePage from './pages/WelcomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'reader/:id', element: <ReaderPage /> },
      { path: 'board', element: <BoardListPage /> },
      { path: 'board/:id', element: <BoardPage /> },
      { path: 'share/:shareId', element: <SharedBoardPage /> },
      { path: 'share/article/:shareId', element: <SharedArticlePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'welcome', element: <WelcomePage /> },
      { path: 'sample', element: <SamplePage /> },
      { path: 'memory', element: <MemoryPage /> },
      { path: 'extension', element: <ExtensionPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

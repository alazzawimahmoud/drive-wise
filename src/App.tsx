import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthCallback } from './pages/AuthCallback';
import { ExamSession } from './pages/ExamSession';
import { DashboardPage } from './pages/Dashboard';
import { AdminDashboardPage } from './pages/AdminDashboard';
import { LessonsPage } from './pages/LessonsPage';
import { LessonStudy } from './pages/LessonStudy';
import React from 'react';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const LoginPage = () => {
  const { loginWithGoogle, user } = useAuth();
  
  if (user) return <Navigate to="/dashboard" replace />;
  
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">🚗 DriveWise</h1>
        <p className="text-slate-600 mb-8">Prepare for your Belgian Driving Exam</p>
        
        <button 
          onClick={loginWithGoogle}
          className="w-full py-3 px-6 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-3 shadow-sm"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>
      </div>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/exam" 
              element={
                <ProtectedRoute>
                  <ExamSession />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <AdminDashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/lessons" 
              element={
                <ProtectedRoute>
                  <LessonsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/study/:slug" 
              element={
                <ProtectedRoute>
                  <LessonStudy />
                </ProtectedRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;


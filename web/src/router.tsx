import { createBrowserRouter, Navigate } from "react-router-dom";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { EditorPage } from "@/pages/editor/EditorPage";
import { CharactersPage } from "@/pages/characters/CharactersPage";
import { ResultPage } from "@/pages/result/ResultPage";
import { AccountPage } from "@/pages/account/AccountPage";
import { LoginPage } from "@/pages/login/LoginPage";

export const router = createBrowserRouter([
  { path: "/",                       element: <Navigate to="/dashboard" replace /> },
  { path: "/dashboard",              element: <DashboardPage /> },
  { path: "/editor",                 element: <EditorPage /> },
  { path: "/projects/:id/edit",      element: <EditorPage /> },
  { path: "/characters",             element: <CharactersPage /> },
  { path: "/result",                 element: <ResultPage /> },
  { path: "/projects/:id/result",    element: <ResultPage /> },
  { path: "/account",                element: <AccountPage /> },
  { path: "/login",                  element: <LoginPage /> },
  { path: "*",                       element: <Navigate to="/dashboard" replace /> },
]);

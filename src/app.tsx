import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";
import VocabularyQuizPage from "@/pages/VocabularyQuizPage/VocabularyQuizPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<VocabularyQuizPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ReviewQueue from "./pages/ReviewQueue";
import ApplicationDetail from "./pages/ApplicationDetail";
import Tracker from "./pages/Tracker";
import BaseResumeEditor from "./pages/BaseResumeEditor";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ReviewQueue />} />
        <Route path="/applications/:id" element={<ApplicationDetail />} />
        <Route path="/tracker" element={<Tracker />} />
        <Route path="/resume" element={<BaseResumeEditor />} />
      </Route>
    </Routes>
  );
}

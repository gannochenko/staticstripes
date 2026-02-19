import "./App.css";
import { VideoFrame } from "./components/VideoFrame";

function App() {
  return (
    <VideoFrame>
      <div className="text_alignment">
        <div className="text_outline">
          <span>Christmas</span> <span>Morning</span> <span>in</span>
          <span>Liberec</span>
        </div>
        <div className="text_outline text_outline__small">
          <span>Dec</span> <span>24</span> <span>2025</span>
        </div>
        <div className="text_outline text_outline__small">
          <span>❄️ 🏔️ 🌨️</span>
        </div>
      </div>
    </VideoFrame>
  );
}

export default App;

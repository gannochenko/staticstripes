import { useEffect } from "react";
import "./App.css";
import { VideoFrame } from "./components/VideoFrame";
import { useAppParams } from "./hooks/useAppParams";

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day} ${year}`;
}

function Content({
  title = "Central Text",
  date,
  tags,
  extra,
  outro,
}: {
  title?: string;
  date?: string;
  tags?: string;
  extra?: string;
  outro?: boolean;
}) {
  let formattedDate = date ? formatDate(date) : undefined;

  tags = "";
  if (outro) {
    title = "Thanks for watching!";
    formattedDate = "";
    extra = "🫶";
  }

  return (
    <div className="text_alignment">
      <div className="text_outline">
        {title.split(" ").map((word, i) => (
          <span key={i}>{word}</span>
        ))}
      </div>
      {formattedDate && (
        <div className="text_outline text_outline__small">
          {formattedDate.split(" ").map((part, i) => (
            <span key={i}>{part}</span>
          ))}
        </div>
      )}
      {extra && (
        <div className="text_outline text_outline__small">
          <span>
            <span>{extra}</span>
          </span>
        </div>
      )}
      {tags && (
        <div className="text_outline text_outline__small">
          {tags.split(",").map((part, i) => {
            return <span key={i}>#{part.trim().replace(/,/g, "")}</span>;
          })}
        </div>
      )}
    </div>
  );
}

function RenderingView({
  title,
  date,
  tags,
  extra,
  outro,
}: {
  title?: string;
  date?: string;
  tags?: string;
  extra?: string;
  outro?: boolean;
}) {
  useEffect(() => {
    document.body.style.background = "transparent";
    (window as unknown as Record<string, unknown>)["__stsRenderComplete"] =
      true;
  }, []);

  return (
    <div className="rendering_container">
      <Content
        title={title}
        date={date}
        tags={tags}
        extra={extra}
        outro={outro}
      />
    </div>
  );
}

function App() {
  const { title, date, tags, extra, rendering, outro } = useAppParams();

  if (rendering) {
    return (
      <RenderingView
        title={title}
        date={date}
        tags={tags}
        extra={extra}
        outro={outro}
      />
    );
  }

  return (
    <VideoFrame initialContent={{ title, date, tags, extra }}>
      {(content) => <Content {...content} />}
    </VideoFrame>
  );
}

export default App;

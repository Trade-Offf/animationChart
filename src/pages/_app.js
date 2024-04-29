import Graph from "./charts/graph";
import "../styles/index.scss";

export default function Home() {
  return (
    <div className="charts">
      <Graph />
      {/* 写一个水印 */}
      <div className="watermark">@狂炫冰美式</div>
    </div>
  );
}

import Game from "./components/Game";

export default function Home() {
  // .app-frame forces landscape on portrait phones (see globals.css).
  return (
    <div className="app-frame">
      <Game />
    </div>
  );
}

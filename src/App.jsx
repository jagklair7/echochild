import { useEffect, useState } from "react";

export default function App() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#0b0b10] flex items-center justify-center text-white">
      <div
        className={`text-center transition-all duration-1000 ease-out ${
          loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <h1 className="mt-6 text-sm md:text-base text-white/40 tracking-widest">
          EchoChild
        </h1>

        <p className="mt-6 text-sm md:text-base text-white/40 tracking-widest">
          I’m in the womb
        </p>
      </div>
    </div>
  );
}
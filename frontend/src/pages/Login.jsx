import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Lock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginAdmin } from "../../config/apis";
import { getFirstAllowedPath } from "@/lib/navigation.jsx";
import logo from "../assets/logo-full.png";

// SVG paths for educational icons
const ICONS = {
  graduationCap: "M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z",
  book: "M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z",
  openBook: "M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z",
  pencil: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  calculator: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3h5v2h-5V6zM7 6h3v3H7V6zm0 5h3v3H7v-3zm0 5h3v3H7v-3zm5 3v-3h5v3h-5zm5-5h-5v-3h5v3z",
  globe: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
  trophy: "M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z",
  lightbulb: "M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z",
  flask: "M6 22h12l-6-10V4h1V2H9v2h1v8L4 22h2zm2-2l4-6.67V4h4v9.33L20 20H6l2-2z",
  compass: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7-3 3-7-7 3-3 7zm5.5-6.5c.83 0 1.5.67 1.5 1.5S12.83 14 12 14s-1.5-.67-1.5-1.5S11.17 11 12 11z",
  music: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
  laptop: "M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z",
  palette: "M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5S18.33 11 17.5 11z",
  microscope: "M9.8 10.7l1.4-1.4-3.5-3.5-1.4 1.4 3.5 3.5zm4.6-7.1l-1.4 1.4 3.5 3.5 1.4-1.4-3.5-3.5zM11 13c-2.76 0-5 2.24-5 5h10c0-2.76-2.24-5-5-5zm-6.9.1L2.7 14.5l1.4 1.4 1.4-1.4-1.4-1.4zm13.8 0l-1.4 1.4 1.4 1.4 1.4-1.4-1.4-1.4z",
  ruler: "M21 6.5l-2.5-2.5-14 14 2.5 2.5L21 6.5zm-16 9l-2.5 2.5L5 20.5l2.5-2.5L5 15.5zm14-14L16.5 4l2.5 2.5L21.5 4 19 1.5z",
};

// Tiled icon grid config: [iconKey, col%, row%, size, opacity, rotation]
const ICON_TILES = [
  // Row 1
  ["graduationCap", 2,   3,  56, 0.18, -12],
  ["pencil",        10,  8,  40, 0.13,  35],
  ["trophy",        20,  4,  48, 0.18,   0],
  ["ruler",         30,  2,  44, 0.13,  20],
  ["book",          42,  6,  48, 0.18,   8],
  ["lightbulb",     55,  3,  40, 0.13, -10],
  ["compass",       66,  7,  44, 0.18,  15],
  ["globe",         78,  2,  52, 0.18,  10],
  ["flask",         88,  8,  40, 0.13,  25],
  ["openBook",      96,  4,  52, 0.18,  -6],
  // Row 2
  ["calculator",    1,  20,  48, 0.18,  -8],
  ["music",         9,  26,  40, 0.13, -20],
  ["microscope",   18,  18,  44, 0.18,  10],
  ["palette",      28,  24,  40, 0.13,  18],
  ["laptop",       38,  19,  44, 0.13,   8],
  ["pencil",       50,  22,  40, 0.13, -25],
  ["flask",        60,  18,  44, 0.18,  15],
  ["ruler",        70,  25,  40, 0.13, -30],
  ["trophy",       80,  20,  48, 0.18, -12],
  ["graduationCap",91,  17,  52, 0.18,   5],
  // Row 3 (flanks only — card is center)
  ["globe",         2,  40,  52, 0.18,  20],
  ["lightbulb",    10,  48,  40, 0.13, -15],
  ["book",          2,  58,  44, 0.18,  12],
  ["compass",      11,  65,  40, 0.13,  25],
  ["openBook",     88,  38,  52, 0.18,  -6],
  ["calculator",   92,  48,  48, 0.18, -12],
  ["music",        88,  58,  40, 0.13, -20],
  ["palette",      93,  66,  44, 0.18, -15],
  // Row 4
  ["microscope",    2,  70,  48, 0.18,  10],
  ["ruler",        11,  78,  40, 0.13, -30],
  ["trophy",       22,  72,  44, 0.18,  -8],
  ["pencil",       33,  76,  40, 0.13,  45],
  ["lightbulb",    44,  71,  44, 0.18, -15],
  ["flask",        56,  75,  40, 0.13,  20],
  ["compass",      67,  70,  44, 0.18,  15],
  ["laptop",       78,  74,  44, 0.13,   8],
  ["book",         88,  72,  48, 0.18,  -8],
  // Row 5 (bottom)
  ["globe",         2,  88,  52, 0.18,   8],
  ["music",        12,  84,  40, 0.13, -20],
  ["graduationCap",24,  90,  48, 0.18,   5],
  ["calculator",   36,  85,  44, 0.13, -10],
  ["openBook",     48,  91,  52, 0.18,   3],
  ["ruler",        60,  86,  40, 0.13,  20],
  ["palette",      71,  90,  44, 0.18, -12],
  ["flask",        82,  84,  40, 0.13,  25],
  ["trophy",       92,  88,  52, 0.18, -10],
];

const Login = () => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: (data) => loginAdmin(data),
    onSuccess: (res) => {
      const loggedInUser = res?.data?.user;
      toast({ title: "Login Successful 🎉", description: "Welcome back!" });
      if (loggedInUser) {
        queryClient.setQueryData(["currentUser"], loggedInUser);
      }
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      const target = getFirstAllowedPath(loggedInUser);
      navigate(target, { replace: true });
    },
    onError: (error) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #fff8f0 0%, #fff3e6 40%, #ffecd6 70%, #ffe0c2 100%)",
      }}
    >
      {/* Dense tiled educational icon background */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        {ICON_TILES.map(([key, left, top, size, opacity, rotate], i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{
              position: "absolute",
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              opacity,
              transform: `rotate(${rotate}deg)`,
              color: "hsl(var(--primary))",
            }}
          >
            <path d={ICONS[key]} />
          </svg>
        ))}
      </div>

      {/* Subtle radial vignette to make card pop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 70% at 50% 50%, transparent 30%, rgba(255,237,213,0.55) 100%)",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl border border-orange-100 p-8 space-y-6">
          {/* Logo & Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-1/2 mb-4">
              <img src={logo} alt="logo" />
            </div>
            <p className="text-muted-foreground text-sm">Management System</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email or Staff ID</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email or Staff ID (e.g. D-0001)"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
                <PasswordInput
                  id="password"
                  placeholder="Enter your password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-orange-900/60">
          <p>© 2025 Concordia College. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;

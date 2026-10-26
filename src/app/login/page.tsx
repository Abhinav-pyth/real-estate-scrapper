import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
export const metadata: Metadata = { title: "Log in — Indore Property Finder", robots: { index: false } };
export default function LoginPage() { return <AuthForm mode="login" />; }

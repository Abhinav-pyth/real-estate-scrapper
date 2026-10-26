import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
export const metadata: Metadata = { title: "Sign up — Indore Property Finder", robots: { index: false } };
export default function RegisterPage() { return <AuthForm mode="register" />; }

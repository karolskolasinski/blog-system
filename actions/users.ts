import { db } from "@/lib/db";
import { User } from "@/types/common";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Timestamp } from "firebase-admin/firestore";
import _ from "lodash";
import { firestore } from "firebase-admin";
import { revalidatePath } from "next/cache";
import DocumentSnapshot = firestore.DocumentSnapshot;
import DocumentData = firestore.DocumentData;
import WithFieldValue = firestore.WithFieldValue;
import { toBase64 } from "@/lib/utils";

export async function init(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const key = formData.get("key");
  const secretKey = process.env.INIT_ADMIN_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Server configuration error");
  }

  if (key !== secretKey) {
    throw new Error("Unauthorized");
  }

  if (!email || !password) {
    throw new Error("Email and password required");
  }

  if (typeof email !== "string" || typeof password !== "string") {
    throw new Error("Invalid input types");
  }

  const hashedPassword = await bcrypt.hash(password.trim(), 10);
  const user = {
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    name: "Admin",
    role: "admin",
    createdAt: Timestamp.now(),
    avatarId: "",
  };

  await save(user);
  redirect("/login?initialized=true");
}

export async function getUsers() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "admin") {
    throw new Error("Unauthorized");
  }

  const fields = ["name", "email", "role", "createdAt"];
  const docSnap = await db.collection("users").select(...fields).get();
  return docSnap.docs.map((doc) => userDocToUser(doc));
}

export async function getUserByEmail(email: string, keepPass?: boolean) {
  const docSnap = await db.collection("users").where("email", "==", email).get();
  return userDocToUser(docSnap.docs[0], keepPass);
}

export async function getUserById(id: string) {
  const docSnap = await db.collection("users").doc(id).get();
  return userDocToUser(docSnap);
}

function userDocToUser(docSnap: DocumentSnapshot<DocumentData, DocumentData>, keepPass?: boolean) {
  if (!docSnap.exists) {
    return null;
  }

  const data = keepPass ? docSnap.data() : _.omit(docSnap.data(), ["password"]);
  return {
    ...data,
    id: docSnap.id,
    createdAt: data?.createdAt?.toDate(),
  } as User;
}

export async function deleteUser(id: string) {
  const session = await auth();
  if (session?.user?.id === id) {
    throw new Error("You cannot delete yourself");
  }
  await db.collection("users").doc(id).delete();
  redirect("/users?deleted=true");
}

export async function saveUser(formData: FormData) {
  const session = await auth();
  const rawData = Object.fromEntries(formData.entries());

  if (session?.user?.id !== rawData.id && session?.user?.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await save({
    ...rawData,
    ...(rawData.password && { password: await bcrypt.hash(rawData.password as string, 10) }),
  });

  if (rawData.settings) {
    revalidatePath("/settings?saved=true");
  } else {
    redirect("/users?saved=true");
  }
}

async function save(user: WithFieldValue<DocumentData>) {
  const docRef = db.collection("users");

  if (user.id) {
    const omitted = _.omit(user, ["id"]);
    await docRef.doc(user.id).update({ ...omitted, createdAt: Timestamp.now() });
  } else {
    const docSnap = await docRef.where("email", "==", user.email).get();
    if (!docSnap.empty) {
      throw new Error("User with this email already exists");
    }
    delete user.id;
    await docRef.add(user);
  }
}

export async function getAvatar(avatarId: string) {
  if (!avatarId) {
    return null;
  }

  const docSnap = await db.collection("images").doc(avatarId).get();
  if (!docSnap.exists) {
    return null;
  }

  return docSnap.data() as { data: string };
}

export async function saveAvatar(formData: FormData) {
  const id = formData.get("id") as string;
  const file = formData.get("avatar") as File;
  const data = file.size > 0 ? await toBase64(file) : "";

  const userSnap = await db.collection("users").doc(id).get();
  const existingAvatarId = userSnap.exists && userSnap.data()?.avatarId
    ? (userSnap.data()!.avatarId as string)
    : "";

  if (existingAvatarId) {
    await db.collection("images").doc(existingAvatarId).update({ data });
  } else {
    const ref = await db.collection("images").add({ data });
    await db.collection("users").doc(id).update({ avatarId: ref.id });
  }

  if (data) {
    redirect("/settings?saved=true");
  } else {
    revalidatePath("/settings");
  }
}

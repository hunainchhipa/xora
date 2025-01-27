import {
  Account,
  Avatars,
  Client,
  Databases,
  ID,
  Query,
  Storage,
} from "react-native-appwrite";
import {
  APPWRITE_ENDPOINT,
  PLATFORM,
  PROJECT_ID,
  DATABASE_ID,
  USER_COLLECTION_ID,
  VIDEO_COLLECTION_ID,
  STORAGE_ID,
} from "@env";

export const config = {
  endpoint: APPWRITE_ENDPOINT,
  platform: PLATFORM,
  projectId: PROJECT_ID,
  databaseId: DATABASE_ID,
  userCollectionId: USER_COLLECTION_ID,
  videoCollectionId: VIDEO_COLLECTION_ID,
  storageId: STORAGE_ID,
};

// Init your React Native SDK
const client = new Client();

client
  .setEndpoint(config.endpoint) // Appwrite Endpoint
  .setProject(config.projectId) // project ID
  .setPlatform(config.platform); // application ID or bundle ID.

// Register User
const account = new Account(client);
const avatars = new Avatars(client);
const databases = new Databases(client);
const storage = new Storage(client);

export const createUser = async (email, password, username) => {
  try {
    const newAccount = await account.create(
      ID.unique(),
      email,
      password,
      username
    );

    if (!newAccount) throw Error;
    const avatarUrl = avatars.getInitials(username);

    await signIn(email, password);

    const newUser = await databases.createDocument(
      config.databaseId,
      config.userCollectionId,
      ID.unique(),
      {
        accountId: newAccount.$id,
        email,
        username,
        avatar: avatarUrl,
      }
    );

    return newUser;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

export const signIn = async (email, password) => {
  try {
    const session = await account.createEmailPasswordSession(email, password);
    return session;
  } catch (error) {
    throw new Error(error);
  }
};

export const getCurrentUser = async () => {
  try {
    const currentAccount = await account.get();

    if (!currentAccount) throw Error;

    const currentUser = await databases.listDocuments(
      config.databaseId,
      config.userCollectionId,
      [Query.equal("accountId", currentAccount.$id)]
    );

    if (!currentUser) throw Error;

    return currentUser.documents[0];
  } catch (error) {
    console.log(error);
  }
};

export const getAllPosts = async () => {
  try {
    const posts = await databases.listDocuments(
      config.databaseId,
      config.videoCollectionId,
      [Query.orderDesc("$createdAt")]
    );

    return posts.documents;
  } catch (error) {
    throw new Error(error);
  }
};

export const getLatestPosts = async () => {
  try {
    const posts = await databases.listDocuments(
      config.databaseId,
      config.videoCollectionId,
      [Query.orderDesc("$createdAt", Query.limit(7))]
    );

    return posts.documents;
  } catch (error) {
    throw new Error(error);
  }
};

export const searchPosts = async (query) => {
  try {
    const posts = await databases.listDocuments(
      config.databaseId,
      config.videoCollectionId,
      [Query.search("title", query)]
    );

    return posts.documents;
  } catch (error) {
    throw new Error(error);
  }
};

export const getUserPosts = async (userId) => {
  try {
    const posts = await databases.listDocuments(
      config.databaseId,
      config.videoCollectionId,
      [Query.equal("creator", userId)],
      [Query.orderDesc("$createdAt")]
    );

    return posts.documents;
  } catch (error) {
    throw new Error(error);
  }
};

export const signOut = async () => {
  try {
    const session = await account.deleteSessions("current");

    return session;
  } catch (error) {
    throw new Error(error);
  }
};

export const getFilePreview = async (fileId, type) => {
  let fileUrl;

  try {
    if (type === "video") {
      fileUrl = storage.getFileView(config.storageId, fileId);
    } else if (type === "image") {
      fileUrl = storage.getFilePreview(
        config.storageId,
        fileId,
        2000,
        2000,
        "top",
        100
      );
    } else {
      throw new Error("Invalid file type");
    }

    if (!fileUrl) throw Error;

    return fileUrl;
  } catch (error) {
    throw new Error(error);
  }
};

export const uploadFile = async (file, type) => {
  let fileUri = file.uri;

  // Normalize iOS `file://` URIs
  if (fileUri.startsWith("file://")) {
    fileUri = fileUri.replace("file://", "");
  }

  const asset = {
    name: file.fileName || "unknown", // Ensure `fileName` is defined
    type: file.mimeType || "application/octet-stream", // Default if `mimeType` is missing,
    size: file.fileSize,
    uri: file.uri,
  };
  console.log("FILE", file);
  try {
    const uploadedFile = await storage.createFile(
      config.storageId,
      ID.unique(),
      asset
    );

    const fileUrl = await getFilePreview(uploadedFile.$id, type);

    return fileUrl;
  } catch (error) {
    throw new Error(error);
  }
};

export const createVideo = async (form) => {
  try {
    const [thumbnailUrl, videoUrl] = await Promise.all([
      uploadFile(form.thumbnail, "image"),
      uploadFile(form.video, "video"),
    ]);

    const newPost = await databases.createDocument(
      config.databaseId,
      config.videoCollectionId,
      ID.unique(),
      {
        title: form.title,
        thumbnail: thumbnailUrl,
        video: videoUrl,
        prompt: form.prompt,
        creator: form.userId,
      }
    );

    return newPost;
  } catch (error) {
    console.log("ERROR", error);
    throw new Error(error);
  }
};

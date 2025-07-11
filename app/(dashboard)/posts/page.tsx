import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardMenu from "@/components/DashboardMenu";
import Link from "next/link";
import { deletePost, getPosts } from "@/actions/posts";
import { ServerComponentProps } from "@/types/common";
import Breadcrumb from "@/components/Breadcrumb";
import AddIcon from "@/public/icons/add.svg";
import EditIcon from "@/public/icons/edit.svg";
import DeleteButton from "@/components/DeleteButton";

export default async function Posts(props: ServerComponentProps) {
  const session = await auth();
  if (!session) {
    return redirect("/login");
  }
  const params = await props.searchParams; // todo: flash message
  const posts = await getPosts();

  return (
    <main className="flex-1 flex w-full">
      <DashboardMenu active="/posts" />

      <section className="flex-1 flex flex-col">
        <Breadcrumb items={[{ label: "Wpisy", href: "/posts" }]} />

        <div className="flex-1 bg-slate-50 p-4 pt-8 border-t border-gray-200">
          <div className="flex gap-4 items-center justify-between">
            <h1 className="text-3xl font-black">Wpisy</h1>

            <Link
              href="/posts/new"
              className="button !rounded-full md:!rounded-md"
            >
              <AddIcon className="w-5 h-5 fill-white" />
              <span className="hidden md:inline">Dodaj wpis</span>
            </Link>
          </div>

          <div className="mt-10 overflow-x-auto rounded-2xl border border-gray-200 shadow">
            <table className="table-auto min-w-full divide-y divide-gray-200 bg-white border-collapse">
              <thead className="border-b border-b-gray-300 font-semibold">
                <tr className="text-left text-xs uppercase">
                  <th className="px-6 py-3">Tytuł</th>
                  <th className="px-6 py-3">Autor</th>
                  <th className="px-6 py-3">Data utworzenia</th>
                  <th className="px-6 py-3">Data aktualizacji</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {posts.map((post) => (
                  <tr key={post.id} className="group align-top">
                    <td className="px-6 py-4">
                      {post.title}
                      <div className="mt-2 flex gap-2 xl:opacity-0 group-hover:opacity-100 text-sm">
                        <Link
                          href={`/posts/${post.id}`}
                          className="flex gap-1 items-center text-sky-600 hover:text-sky-500 duration-100"
                        >
                          <EditIcon className="w-4 h-4 fill-current" />
                          Edytuj
                        </Link>

                        <span className="text-gray-400">|</span>

                        <form
                          action={async () => {
                            "use server";
                            await deletePost(post.id!);
                          }}
                        >
                          <DeleteButton label="Czy na pewno chcesz usunąć ten wpis?" />
                        </form>
                      </div>
                    </td>

                    <td className="px-6 py-4">{post.authorName}</td>
                    <td className="px-6 py-4">{post.createdAt?.toLocaleString()}</td>
                    <td className="px-6 py-4">{post.updatedAt?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

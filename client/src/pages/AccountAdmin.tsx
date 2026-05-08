import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/simpleAuth";
import { Trash2, RotateCcw, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AccountAdmin() {
  const currentUser = getCurrentUser();
  const [username, setUsername] = useState("");

  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.auth.users.useQuery(undefined, {
    enabled: currentUser?.role === "admin",
  });

  const createMutation = trpc.auth.createUser.useMutation({
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message || "사용자 추가 실패");
        return;
      }

      toast.success("사용자가 추가되었습니다.");
      setUsername("");
      utils.auth.users.invalidate();
    },
  });

  const deleteMutation = trpc.auth.deleteUser.useMutation({
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message || "사용자 삭제 실패");
        return;
      }

      toast.success("사용자가 삭제되었습니다.");
      utils.auth.users.invalidate();
    },
  });

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("비밀번호가 1로 초기화되었습니다.");
      utils.auth.users.invalidate();
    },
  });

  if (currentUser?.role !== "admin") {
    return (
      <div className="container py-24 text-center">
        <p className="text-sm text-muted-foreground">
          관리자만 이용할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-4xl mx-auto px-4">
      <div className="mb-8">
        <p className="text-xs font-semibold text-primary tracking-widest uppercase mb-1">
          Admin
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">계정관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          사용자 추가, 삭제, 비밀번호 초기화를 관리합니다.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">사용자 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="추가할 사용자 이름"
            />
            <Button
              className="gap-2"
              onClick={() => {
                if (!username.trim()) {
                  toast.error("사용자 이름을 입력해주세요.");
                  return;
                }

                createMutation.mutate({ username });
              }}
              disabled={createMutation.isPending}
            >
              <Plus className="w-4 h-4" />
              추가
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            신규 사용자의 초기 비밀번호는 1입니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">사용자 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : !users || users.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 사용자가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {users.map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{user.username}</p>
                    <p className="text-xs text-muted-foreground">
                      권한: {user.role === "admin" ? "관리자" : "사용자"} ·
                      비밀번호 설정: {user.passwordSetupDone ? "완료" : "초기값"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        if (confirm(`${user.username}님의 비밀번호를 1로 초기화하시겠습니까?`)) {
                          resetMutation.mutate({ username: user.username });
                        }
                      }}
                    >
                      <RotateCcw className="w-4 h-4" />
                      초기화
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={user.username === "admin"}
                      onClick={() => {
                        if (confirm(`${user.username} 사용자를 삭제하시겠습니까?`)) {
                          deleteMutation.mutate({ username: user.username });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

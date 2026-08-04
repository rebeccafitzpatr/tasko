import { defineStore } from 'pinia';

export interface Todo {
  id: number;
  taskId?: number | null;
  title: string;
  completed?: boolean;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const useTodoStore = defineStore('todos', {
  state: () => ({
    todos: [] as Todo[],
  }),
  actions: {
    async loadTodos() {
      const res = await fetch('/api/todos');
      const data = await res.json();
      this.todos = data;
    },
    async addTodo(payload: Partial<Todo>) {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const t = await res.json();
        this.todos.push(t);
      }
    },
    async toggleTodo(id: number) {
      const t = this.todos.find(x => x.id === id);
      if (!t) return;
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !t.completed }),
      });
      if (res.ok) {
        Object.assign(t, await res.json());
      }
    },
    async removeTodo(id: number) {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        this.todos = this.todos.filter(t => t.id !== id);
      }
    }
  },
  persist: true,
});
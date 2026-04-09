export default function getTimeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalMinutes < 1) {
    return "Just now";
  }
  if (totalMinutes < 60) {
    return `${totalMinutes}m ago`;
  }

  if (totalHours < 24) {
    const remainingMinutes = totalMinutes % 60;
    if (remainingMinutes === 0) {
      return `${totalHours}h ago`;
    } else {
      return `${totalHours}h ${remainingMinutes}m ago`;
    }
  }

  if (totalDays === 1) {
    return "Yesterday";
  }
  if (totalDays < 7) {
    return `${totalDays}d ago`;
  }
  if (totalDays < 30) {
    const weeks = Math.floor(totalDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  return new Date(timestamp).toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

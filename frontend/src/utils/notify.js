import toast from "react-hot-toast";

const success = (msg) => toast.success(msg || "Success");
const error = (msg) => toast.error(msg || "Something went wrong");
const info = (msg) => toast(msg || "Notice");

const notify = { success, error, info };
export default notify;
export { success, error, info };

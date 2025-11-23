import Swal from "sweetalert2";

export async function confirmAction(message, options = {}) {
  const result = await Swal.fire({
    title: "Are you sure?",
    text: message || "Please confirm your action.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: options.confirmText || "Yes",
    cancelButtonText: options.cancelText || "Cancel",
    reverseButtons: true,
  });
  return result.isConfirmed === true;
}

export default confirmAction;

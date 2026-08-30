import { Navigate } from "react-router-dom";


export default function ProtectedRoute({children}) {

    const staff = localStorage.getItem("staff");


    if(!staff){
        return <Navigate to="/login" />;
    }


    return children;
}
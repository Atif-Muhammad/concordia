import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import { Bed, Edit, Trash2 } from "lucide-react";
import {
  getRooms,
  createRoom,
  updateRoom as updateRoomApi,
  deleteRoom as deleteRoomApi,
} from "@/services/api";

export const RoomsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions("Boarding", "rooms");

  const [roomOpen, setRoomOpen] = useState(false);
  const [editMode, setEditMode] = useState({});
  const [roomFormData, setRoomFormData] = useState({
    roomNumber: "",
    roomType: "Double",
    capacity: 2,
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
  });

  const handleAddRoom = async () => {
    if (!roomFormData.roomNumber) {
      toast({ title: "Please enter room number", variant: "destructive" });
      return;
    }
    try {
      if (editMode.room) {
        await updateRoomApi(editMode.room, {
          roomNumber: roomFormData.roomNumber,
          roomType: roomFormData.roomType.toLowerCase(),
          capacity: Number(roomFormData.capacity),
        });
        toast({ title: "Room updated successfully" });
      } else {
        await createRoom({
          roomNumber: roomFormData.roomNumber,
          roomType: roomFormData.roomType.toLowerCase(),
          capacity: Number(roomFormData.capacity),
          hostelName: "Main Hostel",
          status: "vacant",
        });
        toast({ title: "Room added successfully" });
      }
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setRoomOpen(false);
      setEditMode({});
      setRoomFormData({ roomNumber: "", roomType: "Double", capacity: 2 });
    } catch (e) {
      toast({ title: e.message || "Failed to save room", variant: "destructive" });
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;
    try {
      await deleteRoomApi(roomToDelete.id);
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: "Room deleted successfully" });
    } catch (e) {
      toast({ title: e.message || "Failed to delete room", variant: "destructive" });
    } finally {
      setDeleteConfirmOpen(false);
      setRoomToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Room Management</CardTitle>
            {canCreate && (
              <Button onClick={() => {
                setEditMode({});
                setRoomFormData({ roomNumber: "", roomType: "Double", capacity: 2 });
                setRoomOpen(true);
              }}>
                <Bed className="mr-2 h-4 w-4" />
                Add Room
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Room Number</TableHead>
                <TableHead className="py-2 px-3 text-sm">Type</TableHead>
                <TableHead className="py-2 px-3 text-sm">Capacity</TableHead>
                <TableHead className="py-2 px-3 text-sm">Occupancy</TableHead>
                <TableHead className="py-2 px-3 text-sm">Status</TableHead>
                <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="py-2 px-3 text-sm font-medium">{room.roomNumber}</TableCell>
                  <TableCell className="py-2 px-3 text-sm">{room.roomType}</TableCell>
                  <TableCell className="py-2 px-3 text-sm">{room.capacity}</TableCell>
                  <TableCell className="py-2 px-3 text-sm">{room.currentOccupancy} / {room.capacity}</TableCell>
                  <TableCell className="py-2 px-3 text-sm">
                    <Badge variant={room.status === "vacant" ? "success" : room.status === "occupied" ? "destructive" : "secondary"}>
                      {room.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 px-3 text-sm">
                    <div className="flex gap-2">
                      {canUpdate && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditMode({ room: room.id });
                                setRoomFormData({
                                  roomNumber: room.roomNumber,
                                  roomType: room.roomType.charAt(0).toUpperCase() + room.roomType.slice(1),
                                  capacity: room.capacity,
                                });
                                setRoomOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setRoomToDelete(room);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rooms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    No rooms found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={roomOpen} onOpenChange={(open) => {
        setRoomOpen(open);
        if (!open) setEditMode({});
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode.room ? "Edit" : "Add"} Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Room Number</Label>
              <Input
                value={roomFormData.roomNumber}
                onChange={(e) => setRoomFormData({ ...roomFormData, roomNumber: e.target.value })}
              />
            </div>
            <div>
              <Label>Room Type</Label>
              <Select
                value={roomFormData.roomType}
                onValueChange={(value) => setRoomFormData({ ...roomFormData, roomType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single (1 person)</SelectItem>
                  <SelectItem value="Double">Double (2 person)</SelectItem>
                  <SelectItem value="Triple">Triple (3 person)</SelectItem>
                  <SelectItem value="Shared">Shared (4+ person)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Capacity</Label>
              <Input
                type="number"
                min="1"
                value={roomFormData.capacity}
                onChange={(e) => setRoomFormData({ ...roomFormData, capacity: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>
          <Button onClick={handleAddRoom}>{editMode.room ? "Update" : "Add"} Room</Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete Room {roomToDelete?.roomNumber}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRoom} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

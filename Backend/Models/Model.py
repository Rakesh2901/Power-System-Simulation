# Define the PIGNN model
import torch
import torch.nn as nn
from torch_geometric.nn import MessagePassing
from torch_geometric.utils import add_self_loops
class PIGNN(nn.Module):

    def __init__(self,in_dim=5,hidden=64):

        super().__init__()

        self.mp1 = PowerMessagePassing(in_dim,hidden)
        self.mp2 = PowerMessagePassing(hidden,hidden)
        self.mp3 = PowerMessagePassing(hidden,hidden)

        # task heads
        self.state_head = nn.Linear(hidden,2)
        self.stability_head = nn.Linear(hidden,1)
        self.opf_head = nn.Linear(hidden,1)

    def forward(self,x,edge_index):

        h = self.mp1(x,edge_index)
        h = self.mp2(h,edge_index)
        h = self.mp3(h,edge_index)

        state = self.state_head(h)

        stability = torch.sigmoid(self.stability_head(h)).mean()

        opf_cost = self.opf_head(h).mean()

        return state,stability,opf_cost,h
    
class PowerMessagePassing(MessagePassing):

    def __init__(self,in_channels,out_channels):

        super().__init__(aggr='mean')

        self.lin = nn.Linear(in_channels,out_channels)
        self.update_lin = nn.Linear(in_channels+out_channels,out_channels)

    def forward(self,x,edge_index):

        edge_index,_ = add_self_loops(edge_index)

        return self.propagate(edge_index,x=x)

    def message(self,x_j):

        return self.lin(x_j)

    def update(self,aggr_out,x):

        h = torch.cat([x,aggr_out],dim=1)

        return F.relu(self.update_lin(h))
"use client"

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Rss, FileText, Folder, Menu, Sun, Moon, Trash2, Edit, Calendar, ExternalLink, FolderPlus, Globe, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import "./kite-aggregator.css";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("articles");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [isDarkMode, setIsDarkMode] = useState(true); // Changed to true for dark mode default
  
  // Feed management state
  const [isManageFeedsDialogOpen, setIsManageFeedsDialogOpen] = useState(false);
  const [newFeedName, setNewFeedName] = useState("");
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [newFeedType, setNewFeedType] = useState<"rss" | "html">("rss");
  const [editingFeed, setEditingFeed] = useState<any>(null);

  // Article detail state
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [isArticleDetailOpen, setIsArticleDetailOpen] = useState(false);

  // Folder management state
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [articleForFolder, setArticleForFolder] = useState<any>(null);
  const [isFolderSelectionOpen, setIsFolderSelectionOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [isFolderContentOpen, setIsFolderContentOpen] = useState(false);

  // Queries
  const articles = useQuery(api.articles.getAllArticles);
  const feedSources = useQuery(api.feedSources.getFeedSources);
  const customFolders = useQuery(api.customFolders.getCustomFolders);
  const oldArticles = useQuery(api.articles.getOldArticles);
  // Use skip parameter to conditionally run the query only when a folder is selected
  const folderArticles = useQuery(
    api.customFolders.getFolderArticles, 
    selectedFolder ? { folderId: selectedFolder._id } : "skip"
  );

  // Mutations
  const addFeedSource = useMutation(api.feedSources.addFeedSource);
  const deleteFeedSource = useMutation(api.feedSources.deleteFeedSource);
  const updateAllFeeds = useMutation(api.feedSources.triggerUpdateAllFeeds);
  const manualPurgeOldArticles = useMutation(api.articles.manualPurgeOldArticles);
  const createFolder = useMutation(api.customFolders.createCustomFolder);
  const addArticleToFolder = useMutation(api.customFolders.addArticleToFolder);
  const deleteFolder = useMutation(api.customFolders.removeCustomFolder);
  const removeArticleFromFolder = useMutation(api.customFolders.removeArticleFromFolder);

  // Filter articles based on search and source
  const filteredArticles = articles?.filter(article => {
    const matchesSearch = searchTerm === "" || 
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSource = filterSource === "all" || article.sourceFeedName === filterSource;
    
    return matchesSearch && matchesSource;
  });

  // Get unique sources for filter dropdown
  const uniqueSources = Array.from(new Set(articles?.map(article => article.sourceFeedName) || []));

  const handleAddFeed = async () => {
    if (!newFeedName.trim() || !newFeedUrl.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      await addFeedSource({
        name: newFeedName.trim(),
        sourceAddress: newFeedUrl.trim(),
        sourceType: newFeedType,
      });
      
      setNewFeedName("");
      setNewFeedUrl("");
      setNewFeedType("rss");
      setIsManageFeedsDialogOpen(false);
      toast.success("Feed source added successfully!");
    } catch (error) {
      toast.error("Failed to add feed source");
    }
  };

  const handleEditFeed = (feed: any) => {
    setEditingFeed(feed);
    setNewFeedName(feed.name);
    setNewFeedUrl(feed.sourceAddress);
    setNewFeedType(feed.sourceType);
    setIsManageFeedsDialogOpen(true);
  };

  const handleDeleteFeed = async (feedId: Id<"feedSources">) => {
    try {
      await deleteFeedSource({ id: feedId, deleteArticles: true });
      toast.success("Feed source deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete feed source");
    }
  };

  const handleUpdateAllFeeds = async () => {
    try {
      await updateAllFeeds({});
      toast.success("Feed update started! Check back in a few moments.");
    } catch (error) {
      toast.error("Failed to update feeds");
    }
  };

  const handlePurgeOldArticles = async () => {
    try {
      const result = await manualPurgeOldArticles({});
      toast.success(`Cleaned up ${result.deletedCount} old articles`);
    } catch (error) {
      toast.error("Failed to clean up old articles");
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    try {
      await createFolder({ name: newFolderName.trim() });
      setNewFolderName("");
      setIsCreateFolderDialogOpen(false);
      toast.success("Folder created successfully!");

      // If we were adding an article to a folder, open the folder selection dialog
      if (articleForFolder) {
        setIsFolderSelectionOpen(true);
      }
    } catch (error) {
      toast.error("Failed to create folder");
    }
  };

  const handleAddArticleToFolder = async (folderId: Id<"customFolders">) => {
    if (!articleForFolder) return;

    try {
      await addArticleToFolder({
        folderId,
        articleId: articleForFolder._id,
      });
      setArticleForFolder(null);
      setIsFolderSelectionOpen(false);
      toast.success("Article added to folder!");
    } catch (error) {
      toast.error("Failed to add article to folder");
    }
  };

  const handleDeleteFolder = async (folderId: Id<"customFolders">) => {
    try {
      await deleteFolder({ id: folderId });
      toast.success("Folder deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete folder");
    }
  };

  const handleRemoveArticleFromFolder = async (folderId: Id<"customFolders">, articleId: Id<"articles">) => {
    try {
      await removeArticleFromFolder({
        folderId,
        articleId,
      });
      toast.success("Article removed from folder");
    } catch (error) {
      toast.error("Failed to remove article from folder");
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-7xl">
        <Card className="kite-main-card">
          {/* Main Headline */}
          <CardHeader className="kite-main-headline">
            <CardTitle className="kite-headline-text">
              KITE Aggregator
            </CardTitle>
          </CardHeader>

          {/* Navigation and Controls */}
          <CardHeader className="border-b border-border bg-background/95 backdrop-blur-lg sticky top-0 z-50">
            <div className="container flex h-14 items-center">
              <div className="mr-4 flex items-center">
                {/* Mobile Menu */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="md:hidden mr-2">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-64">
                    <div className="py-4">
                      <h2 className="text-lg font-semibold mb-4">Navigation</h2>
                      <div className="space-y-2">
                        <Button 
                          variant={activeTab === "articles" ? "default" : "ghost"} 
                          className="w-full justify-start"
                          onClick={() => setActiveTab("articles")}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Articles
                        </Button>
                        <Button 
                          variant={activeTab === "sources" ? "default" : "ghost"} 
                          className="w-full justify-start"
                          onClick={() => setActiveTab("sources")}
                        >
                          <Rss className="h-4 w-4 mr-2" />
                          Feed Sources
                        </Button>
                        <Button 
                          variant={activeTab === "folders" ? "default" : "ghost"} 
                          className="w-full justify-start"
                          onClick={() => setActiveTab("folders")}
                        >
                          <Folder className="h-4 w-4 mr-2" />
                          Custom Folders
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              
              {/* Desktop Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="articles" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Articles
                  </TabsTrigger>
                  <TabsTrigger value="sources" className="flex items-center gap-2">
                    <Rss className="h-4 w-4" />
                    Feed Sources
                  </TabsTrigger>
                  <TabsTrigger value="folders" className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    Custom Folders
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                {activeTab === "articles" && (
                  <div className="w-full flex-1 md:w-auto md:flex-none">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search articles..."
                          className="pl-8 md:w-[200px]"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <Select value={filterSource} onValueChange={setFilterSource}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sources</SelectItem>
                          {uniqueSources.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  {activeTab === "sources" && (
                    <Dialog open={isManageFeedsDialogOpen} onOpenChange={setIsManageFeedsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Source
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>{editingFeed ? "Edit Feed Source" : "Add New Feed Source"}</DialogTitle>
                          <DialogDescription>
                            {editingFeed ? "Update your feed source details." : "Add a new RSS feed or HTML website to aggregate content from."}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                              Name
                            </Label>
                            <Input
                              id="name"
                              value={newFeedName}
                              onChange={(e) => setNewFeedName(e.target.value)}
                              className="col-span-3"
                              placeholder="e.g., Tech News"
                            />
                          </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="url" className="text-right">
                              URL
                            </Label>
                            <Input
                              id="url"
                              value={newFeedUrl}
                              onChange={(e) => setNewFeedUrl(e.target.value)}
                              className="col-span-3"
                              placeholder="https://example.com/feed.xml"
                            />
                          </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">
                              Type
                            </Label>
                            <Select value={newFeedType} onValueChange={(value: "rss" | "html") => setNewFeedType(value)}>
                              <SelectTrigger className="col-span-3">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="rss">RSS Feed</SelectItem>
                                <SelectItem value="html">HTML Website</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => {
                            setIsManageFeedsDialogOpen(false);
                            setEditingFeed(null);
                            setNewFeedName("");
                            setNewFeedUrl("");
                            setNewFeedType("rss");
                          }}>
                            Cancel
                          </Button>
                          <Button onClick={handleAddFeed}>
                            {editingFeed ? "Update Source" : "Add Source"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}

                  {(activeTab === "articles" || activeTab === "sources") && (
                    <Button variant="outline" size="sm" onClick={handleUpdateAllFeeds}>
                      <Rss className="h-4 w-4 mr-2" />
                      Update All
                    </Button>
                  )}

                  {activeTab === "articles" && oldArticles && oldArticles.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clean ({oldArticles.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clean Up Old Articles</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {oldArticles.length} articles older than 2 years. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handlePurgeOldArticles}>
                            Delete Old Articles
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  
                  <Button variant="ghost" size="sm" onClick={toggleDarkMode}>
                    {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Main Content */}
          <CardContent className="p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="articles">
                <div className="kite-animate-in">
                  <Card className="kite-content-card">
                    <CardHeader className="pb-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="kite-section-title">Articles</CardTitle>
                          <CardDescription className="kite-section-description">
                            Browse and manage articles from all your sources (last 2 years)
                            {filterSource !== "all" && (
                              <span className="block text-sm mt-1">
                                Filtered by: <span className="font-medium">{filterSource}</span>
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-sm">
                            {filteredArticles?.length || 0} articles
                          </Badge>
                          {filterSource !== "all" && (
                            <Badge variant="outline" className="text-sm">
                              {filterSource}
                            </Badge>
                          )}
                          {oldArticles && oldArticles.length > 0 && (
                            <Badge variant="destructive" className="text-sm">
                              {oldArticles.length} old
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {filteredArticles && filteredArticles.length > 0 ? (
                        <div className="grid gap-4">
                          {filteredArticles.map((article, index) => (
                            <Card 
                              key={article._id} 
                              className="kite-article-card cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => {
                                setSelectedArticle(article);
                                setIsArticleDetailOpen(true);
                              }}
                            >
                              <div className="kite-article-title">
                                {article.title}
                              </div>
                              <div className="kite-article-content">
                                {article.content.substring(0, 200)}...
                              </div>
                              <div className="kite-article-meta">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {article.sourceFeedName}
                                  </Badge>
                                  <span>{new Date(article.publicationDate).toLocaleDateString()}</span>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent card click
                                      setArticleForFolder(article);
                                      setIsFolderSelectionOpen(true);
                                    }}
                                  >
                                    <FolderPlus className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    asChild
                                    onClick={(e) => e.stopPropagation()} // Prevent card click
                                  >
                                    <a href={article.originalAddress} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <Card className="kite-empty-state">
                          <CardContent className="kite-empty-content">
                            <FileText className="kite-empty-icon" />
                            <h3 className="kite-empty-title">
                              {searchTerm || filterSource !== "all" ? "No articles found" : "No articles yet"}
                            </h3>
                            <p className="kite-empty-description">
                              {searchTerm || filterSource !== "all" 
                                ? "Try adjusting your search or filter criteria."
                                : "Add your first RSS feed or website to get started."
                              }
                            </p>
                            {(searchTerm || filterSource !== "all") && (
                              <Button onClick={() => { setSearchTerm(""); setFilterSource("all"); }}>
                                Clear Filters
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="sources">
                <div className="kite-animate-in">
                  <Card className="kite-content-card">
                    <CardHeader className="pb-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="kite-section-title">Feed Sources</CardTitle>
                          <CardDescription className="kite-section-description">
                            Manage your RSS feeds and HTML websites
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-sm">
                            {feedSources?.length || 0} sources
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="grid gap-4">
                        {feedSources?.map((feed, index) => (
                          <Card key={feed._id} className="kite-feed-card">
                            <div className="kite-feed-header">
                              <div className="kite-feed-info">
                                <div className="kite-feed-title">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold">{feed.name}</h3>
                                    <Badge variant={feed.sourceType === "rss" ? "default" : "secondary"}>
                                      {feed.sourceType.toUpperCase()}
                                    </Badge>
                                    <Badge variant={feed.isActive ? "default" : "destructive"}>
                                      {feed.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="kite-feed-url">{feed.sourceAddress}</p>
                                {feed.lastChecked && (
                                  <p className="kite-feed-meta">
                                    Last checked: {new Date(feed.lastChecked).toLocaleString()}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditFeed(feed)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteFeed(feed._id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                        
                        {(!feedSources || feedSources.length === 0) && (
                          <Card className="kite-empty-state">
                            <CardContent className="kite-empty-content">
                              <Rss className="kite-empty-icon" />
                              <h3 className="kite-empty-title">No feed sources yet</h3>
                              <p className="kite-empty-description">
                                Add your first RSS feed or website to get started.
                              </p>
                              <Button onClick={() => setIsManageFeedsDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Your First Source
                              </Button>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="folders">
                <div className="kite-animate-in">
                  <Card className="kite-content-card">
                    <CardHeader className="pb-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="kite-section-title">Custom Folders</CardTitle>
                          <CardDescription className="kite-section-description">
                            Organize your articles into custom collections
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-sm">
                            {customFolders?.length || 0} folders
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {customFolders?.map((folder, index) => (
                          <Card 
                            key={folder._id} 
                            className="kite-folder-card cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => {
                              setSelectedFolder(folder);
                              setIsFolderContentOpen(true);
                            }}
                          >
                            <CardHeader>
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <CardTitle className="flex items-center gap-2">
                                    <Folder className="h-4 w-4" />
                                    {folder.name}
                                  </CardTitle>
                                  <CardDescription className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Created: {new Date(folder.dateCreated).toLocaleDateString()}
                                  </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent card click
                                      setNewFolderName(folder.name);
                                      setIsCreateFolderDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent card click
                                      handleDeleteFolder(folder._id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                          </Card>
                        ))}

                        {(!customFolders || customFolders.length === 0) && (
                          <Card className="md:col-span-2 lg:col-span-3 kite-empty-state">
                            <CardContent className="kite-empty-content">
                              <Folder className="kite-empty-icon" />
                              <h3 className="kite-empty-title">No folders yet</h3>
                              <p className="kite-empty-description">
                                Create custom folders to organize your articles.
                              </p>
                              <Button onClick={() => setIsCreateFolderDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Your First Folder
                              </Button>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Article Detail Dialog */}
      <Dialog open={isArticleDetailOpen} onOpenChange={setIsArticleDetailOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedArticle.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">{selectedArticle.sourceFeedName}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(selectedArticle.publicationDate).toLocaleDateString()}
                  </span>
                </div>
              </DialogHeader>
              <div className="py-4 article-content" dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
              <DialogFooter>
                <div className="flex justify-between w-full">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setArticleForFolder(selectedArticle);
                      setIsFolderSelectionOpen(true);
                    }}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Save to Folder
                  </Button>
                  <Button asChild>
                    <a href={selectedArticle.originalAddress} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Source
                    </a>
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a folder to organize your articles.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="folderName" className="text-right">
                Name
              </Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Tech News"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateFolderDialogOpen(false);
              setNewFolderName("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Selection Dialog */}
      <Dialog open={isFolderSelectionOpen} onOpenChange={setIsFolderSelectionOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save to Folder</DialogTitle>
            <DialogDescription>
              Choose a folder to save this article to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {customFolders && customFolders.length > 0 ? (
              <div className="space-y-2">
                {customFolders.map((folder) => (
                  <Button
                    key={folder._id}
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={() => handleAddArticleToFolder(folder._id)}
                  >
                    <Folder className="h-4 w-4 mr-2" />
                    {folder.name}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  className="w-full justify-start text-left mt-4"
                  onClick={() => {
                    setIsFolderSelectionOpen(false);
                    setIsCreateFolderDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Folder
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <Folder className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <h3 className="font-medium mb-2">No folders yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first folder to save articles.
                </p>
                <Button
                  onClick={() => {
                    setIsFolderSelectionOpen(false);
                    setIsCreateFolderDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Folder
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsFolderSelectionOpen(false);
              setArticleForFolder(null);
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Content Dialog */}
      <Dialog open={isFolderContentOpen} onOpenChange={setIsFolderContentOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          {selectedFolder && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  {selectedFolder.name}
                </DialogTitle>
                <DialogDescription>
                  Created: {new Date(selectedFolder.dateCreated).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                {folderArticles && folderArticles.length > 0 ? (
                  <div className="space-y-4">
                    {folderArticles.map((article) => (
                      <Card 
                        key={article._id} 
                        className="kite-article-card cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          setSelectedArticle(article);
                          setIsArticleDetailOpen(true);
                          setIsFolderContentOpen(false);
                        }}
                      >
                        <div className="kite-article-title">
                          {article.title}
                        </div>
                        <div className="kite-article-content">
                          {article.content.substring(0, 150)}...
                        </div>
                        <div className="kite-article-meta">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {article.sourceFeedName}
                            </Badge>
                            <span>{new Date(article.publicationDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveArticleFromFolder(selectedFolder._id, article._id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a href={article.originalAddress} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <h3 className="font-medium mb-2">No articles in this folder</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Browse articles and add them to this folder.
                    </p>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFolderContentOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
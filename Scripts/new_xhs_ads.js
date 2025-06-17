/*
引用地址 https://raw.githubusercontent.com/RuCu6/Loon/main/Scripts/xiaohongshu.js
*/
// 2025-06-09 21:55

const url = $request.url;
if (!$response.body) $done({});
let obj = JSON.parse($response.body);

// 处理函数映射
const urlHandlers = new Map([
    [
        "/v3/user/me",
        (obj) => {
          if (obj?.data?.zhong_tong_bar_info?.conversions?.length > 0) {
            obj.data.zhong_tong_bar_info.conversions = obj.data.zhong_tong_bar_info.conversions.filter(
              item => item?.id !== "32" && item?.id !== "20" && item?.id !== "11"
            );
          }
          if (obj?.data?.hula_tabs?.all_show_tab_config?.length > 0) {
            obj.data.hula_tabs.all_show_tab_config = obj.data.hula_tabs.all_show_tab_config.filter(
              item => item?.tab_id !== "note" && item?.tab_id !== "atMe"
            );
          }
          
          return obj;
        }
      ],
    [
      "/v6/homefeed/categories",
      (obj) => {
        if (obj?.data?.categories?.length > 0) {
          obj.data.categories = obj.data.categories.filter(
            item => !(item?.oid?.includes("live") || item?.oid?.includes("sketch"))
          );
        }
        return obj;
      }
    ],
    [
      "/v1/interaction/comment/video/download",
      (obj) => {
        const commitsCache = JSON.parse($persistentStore.read("redBookCommentLivePhoto"));
        if (commitsCache?.livePhotos?.length > 0 && obj?.data?.video) {
          const matchedPhoto = commitsCache.livePhotos.find(
            item => item?.videId === obj?.data?.video?.video_id
          );
          if (matchedPhoto) {
            obj.data.video.video_url = matchedPhoto.videoUrl;
          }
        }
        return obj;
      }
    ],
    [
      "/v1/note/imagefeed",
      handleImageFeed
    ],
    [
      "/v2/note/feed",
      handleImageFeed
    ],
    [
      "/v1/note/live_photo/save",
      (obj) => {
        const livePhoto = JSON.parse($persistentStore.read("redBookLivePhoto"));
        if (obj?.data?.datas?.length > 0 && livePhoto?.length > 0) {
          obj.data.datas.forEach((itemA) => {
            livePhoto.forEach((itemB) => {
              if (itemB?.file_id === itemA?.file_id && itemA?.url) {
                itemA.url = itemA.url.replace(/^https?:\/\/.*\.mp4$/g, itemB.url);
              }
            });
          });
        } else {
          obj = { code: 0, success: true, msg: "成功", data: { datas: livePhoto } };
        }
        return obj;
      }
    ],
    [
      "/v1/system/service/ui/config",
      (obj) => {
        if (obj?.data?.sideConfigHomepage?.componentConfig?.sidebar_config_cny_2025) {
          obj.data.sideConfigHomepage.componentConfig.sidebar_config_cny_2025 = {};
        }
        if (obj?.data?.sideConfigPersonalPage?.componentConfig?.sidebar_config_cny_2025) {
          obj.data.sideConfigPersonalPage.componentConfig.sidebar_config_cny_2025 = {};
        }
        return obj;
      }
    ],
    [
      "/v1/system_service/config",
      (obj) => {
        const itemsToDelete = ["app_theme", "loading_img", "splash", "store"];
        if (obj?.data) {
          itemsToDelete.forEach(item => delete obj.data[item]);
        }
        return obj;
      }
    ],
    [
      "/v2/note/widgets",
      (obj) => {
        const itemsToDelete = [
          "cooperate_binds", "generic", "note_next_step", "widgets_nbb",
          "widgets_ncb", "widgets_ndb", "hot_reco_info", "widget_list"
        ];
        if (obj?.data) {
          itemsToDelete.forEach(item => delete obj.data[item]);
        }
        return obj;
      }
    ],
    [
      "/v2/system_service/splash_config",
      (obj) => {
        if (obj?.data?.ads_groups?.length > 0) {
          const futureTime = {
            start: 3818332800,
            end: 3818419199
          };
          obj.data.ads_groups.forEach(group => {
            group.start_time = futureTime.start;
            group.end_time = futureTime.end;
            if (group?.ads?.length > 0) {
              group.ads.forEach(ad => {
                ad.start_time = futureTime.start;
                ad.end_time = futureTime.end;
              });
            }
          });
        }
        return obj;
      }
    ],
    [
      "/v2/user/followings/followfeed",
      (obj) => {
        if (obj?.data?.items?.length > 0) {
          obj.data.items = obj.data.items.filter(i => i?.recommend_reason === "friend_post");
        }
        return obj;
      }
    ],
    [
      "/v3/note/videofeed",
      handleVideoFeed
    ],
    [
      "/v4/followfeed",
      (obj) => {
        if (obj?.data?.items?.length > 0) {
          obj.data.items = obj.data.items.filter(i => !["recommend_user"]?.includes(i?.recommend_reason));
        }
        return obj;
      }
    ],
    [
      "/v4/note/videofeed",
      handleVideoFeedV4
    ],
    [
      "/v5/note/comment/list",
      handleCommentList
    ],
    [
      "/v5/recommend/user/follow_recommend",
      (obj) => {
        if (obj?.data?.title === "你可能感兴趣的人" && obj?.data?.rec_users?.length > 0) {
          obj.data = {};
        }
        return obj;
      }
    ],
    [
      "/v6/homefeed",
      (obj) => {
        if (obj?.data?.length > 0) {
          obj.data = obj.data.filter(item => {
            if (item?.model_type === "live_v2") return false;
            if (item.hasOwnProperty("ads_info")) return false;
            if (item.hasOwnProperty("card_icon")) return false;
            if (item.hasOwnProperty("note_attributes")) return false;
            if (item?.note_attributes?.includes("goods")) return false;
            
            if (item?.related_ques) {
              delete item.related_ques;
            }
            return true;
          });
        }
        return obj;
      }
    ],
    [
      "/v10/note/video/save",
      handleVideoSave
    ],
    [
      "/v10/search/notes",
      (obj) => {
        if (obj?.data?.items?.length > 0) {
          obj.data.items = obj.data.items.filter(i => i?.model_type === "note");
        }
        return obj;
      }
    ]
  ]);
  
  // 处理图片信息流
function handleImageFeed(obj) {
    let newDatas = [];
    if (obj?.data?.[0]?.note_list?.length > 0) {
      for (let item of obj.data[0].note_list) {
        if (item?.media_save_config) {
          item.media_save_config.disable_save = false;
          item.media_save_config.disable_watermark = true;
          item.media_save_config.disable_weibo_cover = true;
        }
        handleShareInfo(item);
        if (item?.images_list?.length > 0) {
          handleLivePhotos(item.images_list, newDatas);
        }
      }
    }
    return obj;
  }
  
  // 处理视频信息流
  function handleVideoFeed(obj) {
    if (obj?.data?.length > 0) {
      for (let item of obj.data) {
        if (item?.media_save_config) {
          item.media_save_config.disable_save = false;
          item.media_save_config.disable_watermark = true;
          item.media_save_config.disable_weibo_cover = true;
        }
        handleShareInfo(item);
      }
    }
    return obj;
  }
  
  // 处理视频信息流 V4
  function handleVideoFeedV4(obj) {
    let modDatas = [];
    let newDatas = [];
    let unlockDatas = [];
  
    if (obj?.data?.length > 0) {
      for (let item of obj.data) {
        if (item?.model_type === "note") {
          if (item?.id && item?.video_info_v2?.media?.stream?.h265?.[0]?.master_url) {
            newDatas.push({
              id: item.id,
              url: item.video_info_v2.media.stream.h265[0].master_url
            });
          }
          handleShareInfo(item);
          if (!item.hasOwnProperty("ad")) {
            modDatas.push(item);
          }
        }
      }
      obj.data = modDatas;
      $persistentStore.write(JSON.stringify(newDatas), "redBookVideoFeed");
    }
  
    handleVideoFeedUnlock(obj, unlockDatas);
    return obj;
  }
  
  // 处理评论列表
  function handleCommentList(obj) {
    replaceRedIdWithFmz200(obj.data);
    let livePhotos = [];
    let note_id = "";
  
    if (obj?.data?.comments?.length > 0) {
      note_id = obj.data.comments[0].note_id;
      for (const comment of obj.data.comments) {
        processComment(comment, livePhotos);
        if (comment?.sub_comments?.length > 0) {
          comment.sub_comments.forEach(sub_comment => processComment(sub_comment, livePhotos));
        }
      }
    }
  
    if (livePhotos?.length > 0) {
      saveLivePhotos(note_id, livePhotos);
    }
    return obj;
  }
  
  // 处理视频保存
  function handleVideoSave(obj) {
    const videoFeed = JSON.parse($persistentStore.read("redBookVideoFeed"));
    const videoFeedUnlock = JSON.parse($persistentStore.read("redBookVideoFeedUnlock"));
  
    if (obj?.data?.note_id) {
      if (videoFeed?.length > 0) {
        const matchedVideo = videoFeed.find(item => item.id === obj.data.note_id);
        if (matchedVideo) {
          obj.data.download_url = matchedVideo.url;
        }
      }
  
      if (videoFeedUnlock?.length > 0 && obj?.data?.disable === true) {
        delete obj.data.disable;
        delete obj.data.msg;
        obj.data.download_url = "";
        obj.data.status = 2;
  
        const matchedVideo = videoFeedUnlock.find(item => item.id === obj.data.note_id);
        if (matchedVideo) {
          obj.data.download_url = matchedVideo.url;
        }
      }
    }
  
    $persistentStore.write(JSON.stringify({ gayhub: "rucu6" }), "redBookVideoFeedUnlock");
    return obj;
  }
  
  // 辅助函数
  function handleShareInfo(item) {
    if (item?.share_info?.function_entries?.length > 0) {
      const additem = { type: "video_download" };
      const videoDownloadIndex = item.share_info.function_entries.findIndex(i => i?.type === "video_download");
      
      if (videoDownloadIndex !== -1) {
        const videoDownloadEntry = item.share_info.function_entries.splice(videoDownloadIndex, 1)[0];
        item.share_info.function_entries.splice(0, 0, videoDownloadEntry);
      } else {
        item.share_info.function_entries.splice(0, 0, additem);
      }
    }
  }
  
  function handleLivePhotos(imagesList, newDatas) {
    for (let i of imagesList) {
      if (i.hasOwnProperty("live_photo_file_id") && i.hasOwnProperty("live_photo")) {
        if (
          i?.live_photo_file_id &&
          i?.live_photo?.media?.video_id &&
          i?.live_photo?.media?.stream?.h265?.[0]?.master_url
        ) {
          newDatas.push({
            file_id: i.live_photo_file_id,
            video_id: i.live_photo.media.video_id,
            url: i.live_photo.media.stream.h265[0].master_url
          });
        }
      }
    }
    $persistentStore.write(JSON.stringify(newDatas), "redBookLivePhoto");
  }
  
  function handleVideoFeedUnlock(obj, unlockDatas) {
    let videoFeedUnlock = JSON.parse($persistentStore.read("redBookVideoFeedUnlock"));
    if (videoFeedUnlock?.gayhub === "rucu6") {
      if (obj?.data?.length > 0) {
        for (let item of obj.data) {
          if (item?.id && item?.video_info_v2?.media?.stream?.h265?.[0]?.master_url) {
            unlockDatas.push({
              id: item.id,
              url: item.video_info_v2.media.stream.h265[0].master_url
            });
          }
        }
      }
      $persistentStore.write(JSON.stringify(unlockDatas), "redBookVideoFeedUnlock");
    }
  }
  
  function processComment(comment, livePhotos) {
    if (comment?.comment_type === 3) {
      comment.comment_type = 2;
    }
    if (comment?.media_source_type === 1) {
      comment.media_source_type = 0;
    }
    if (comment?.pictures?.length > 0) {
      for (const picture of comment.pictures) {
        if (picture?.video_id) {
          const picObj = JSON.parse(picture.video_info);
          if (picObj?.stream?.h265?.[0]?.master_url) {
            livePhotos.push({
              videId: picture.video_id,
              videoUrl: picObj.stream.h265[0].master_url
            });
          }
        }
      }
    }
  }
  
  function saveLivePhotos(note_id, livePhotos) {
    let commitsRsp;
    const commitsCache = JSON.parse($persistentStore.read("redBookCommentLivePhoto"));
    
    if (!commitsCache) {
      commitsRsp = { noteId: note_id, livePhotos: livePhotos };
    } else {
      commitsRsp = commitsCache;
      if (commitsRsp?.noteId === note_id) {
        commitsRsp.livePhotos = deduplicateLivePhotos(commitsRsp.livePhotos.concat(livePhotos));
      } else {
        commitsRsp = { noteId: note_id, livePhotos: livePhotos };
      }
    }
    
    $persistentStore.write(JSON.stringify(commitsRsp), "redBookCommentLivePhoto");
  }
  
  function deduplicateLivePhotos(livePhotos) {
    const seen = new Map();
    return livePhotos.filter((item) => {
      if (seen.has(item.videId)) {
        return false;
      }
      seen.set(item.videId, true);
      return true;
    });
  }
  
  function replaceRedIdWithFmz200(obj) {
    if (Array.isArray(obj)) {
      obj.forEach((item) => replaceRedIdWithFmz200(item));
    } else if (typeof obj === "object" && obj !== null) {
      if ("red_id" in obj) {
        obj.fmz200 = obj.red_id;
        delete obj.red_id;
      }
      Object.keys(obj).forEach((key) => {
        replaceRedIdWithFmz200(obj[key]);
      });
    }
  }
  
  // 主处理逻辑
  function handleResponse(url, obj) {
    for (const [urlPattern, handler] of urlHandlers) {
      if (url.includes(urlPattern)) {
        return handler(obj);
      }
    }
    return obj;
  }
  
  // 执行处理
  obj = handleResponse(url, obj);
  $done({ body: JSON.stringify(obj) });